/* =============================================================================
 * SISTEM ENVIO VIGI — Biblioteca do servidor (Serverless Functions)
 * ----------------------------------------------------------------------------
 * POR QUE EXISTE ESTE ARQUIVO:
 *   A versao anterior do app falava DIRETAMENTE com o Supabase a partir do
 *   navegador usando a chave `anon` embutida no index.html. O login era
 *   cosmetico (PBKDF2 no cliente) e nenhuma identidade real chegava ao banco:
 *   quem copiasse a chave anon do codigo podia ler, alterar e EXCLUIR todos os
 *   pedidos, de todas as filiais.
 *
 *   Agora o navegador fala apenas com estas functions. A chave real
 *   (service_role) fica no ambiente do Vercel e nunca e enviada ao cliente.
 *   O RLS do banco passa a permitir SOMENTE o service_role.
 *
 * VARIAVEIS DE AMBIENTE (Vercel -> Settings -> Environment Variables)
 *   SUPABASE_URL               URL do projeto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY  chave service_role (OBRIGATORIA)
 *   SISTEM_SESSION_SECRET      segredo HMAC dos tokens (min. 32 caracteres)
 *   SISTEM_USER_CREDS          JSON: { "<usuario>": { "salt": "...", "hash": "..." } }
 *   SISTEM_USERS               JSON: { "<usuario>": { "name","role","filial","dbBranch" } }
 *
 * IMPORTANTE: as credenciais saem do codigo publico. Os pares (salt, hash)
 * no `index.html` eram publicos e permitiam ataque de dicionario offline.
 * ========================================================================== */

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hnfhrjgzeivzrcpumkyk.supabase.co';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas (igual a validade do app)

// PBKDF2-SHA256: mesmos parametros usados no bundle do app, para que a
// migracao do login para o servidor nao invalide as senhas existentes.
const PBKDF2_ITERATIONS = 210000;
const PBKDF2_KEY_LEN = 32;

const TABLES = {
  COMPRAS: 'compras',
  SHIPMENTS: 'shipments',
  ITEMS: 'shipment_items'
};
const TABLE_LIST = Object.values(TABLES);

/* ── Dados de configuracao (SEMPRE falha fechada) ─────────────────────────── */

/**
 * Mapa de usuarios com papel e filial. Vem do ambiente (SISTEM_USERS).
 * Sem a variavel -> objeto vazio -> todo usuario e considerado invalido
 * (401 no login, 403 nas operacoes).
 */
function systemUsers() {
  const raw = process.env.SISTEM_USERS;
  if (!raw || !raw.trim()) {
    console.error('[_lib] SISTEM_USERS ausente no ambiente (falha fechada).');
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    console.error('[_lib] SISTEM_USERS invalido (JSON):', e.message);
    return {};
  }
}

/**
 * Pares (salt, hash) PBKDF2 por usuario. Vem do ambiente (SISTEM_USER_CREDS).
 * Sem a variavel -> objeto vazio -> nenhuma senha valida -> login sempre 401.
 */
function userCreds() {
  const raw = process.env.SISTEM_USER_CREDS;
  if (!raw || !raw.trim()) {
    console.error('[_lib] SISTEM_USER_CREDS ausente no ambiente (falha fechada).');
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    console.error('[_lib] SISTEM_USER_CREDS invalido (JSON):', e.message);
    return {};
  }
}

function sessionSecret() {
  const s = process.env.SISTEM_SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SISTEM_SESSION_SECRET ausente ou curto demais (minimo 32 caracteres).');
  }
  return s;
}


/* ── Senhas ──────────────────────────────────────────────────────────────── */

/** Deriva o hash PBKDF2-SHA256 da senha (mesmo formato do bundle do app). */
function pbkdf2Hex(password, saltHex) {
  if (!password || !saltHex) return '';
  const salt = Buffer.from(String(saltHex), 'hex');
  return crypto
    .pbkdf2Sync(String(password), salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, 'sha256')
    .toString('hex');
}

/**
 * Confere a senha do usuario contra o par (salt, hash) guardado no servidor.
 * Comparacao em tempo constante.
 */
function verifyPassword(username, password) {
  if (!username || !password) return false;
  const cred = userCreds()[username];
  if (!cred || !cred.salt || !cred.hash) return false;
  const derived = pbkdf2Hex(password, cred.salt);
  const a = Buffer.from(derived, 'utf8');
  const b = Buffer.from(String(cred.hash), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* ── Token de sessao (HMAC-SHA256) ────────────────────────────────────────── */

/** Gera um token de sessao assinado (payload.sig). */
function signToken(user, ttlMs) {
  const exp = Date.now() + (ttlMs || SESSION_TTL_MS);
  const payload = Buffer.from(JSON.stringify({ user: user, exp: exp }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return payload + '.' + sig;
}

/** Valida o token. Retorna { user, exp } ou null. */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const payload = parts[0];
  let expected;
  try {
    expected = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  } catch (e) { return null; }
  const a = Buffer.from(String(parts[1]));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!data || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
  if (!data.user || !systemUsers()[data.user]) return null;
  return data;
}

/**
 * Extrai a sessao do request. Retorna null quando nao ha token valido.
 * `session` carrega: username, name, role, filial, dbBranch.
 */
function readSession(req) {
  const token = bearer(req);
  if (!token) return null;
  const data = verifyToken(token);
  if (!data) return null;
  const users = systemUsers();
  const u = users[data.user];
  if (!u) return null;
  return {
    username: data.user,
    name: String(u.name || data.user),
    role: u.role === 'admin' ? 'admin' : 'filial',
    filial: String(u.filial || ''),
    dbBranch: String(u.dbBranch || '')
  };
}


/* ── Rate limit (server-side) ──────────────────────────────────────────────
 * O app nao deve ter bloqueio de senha no navegador: bastaria limpar o
 * localStorage para burlar. A contagem de tentativas mora aqui.
 *
 * Limitacao conhecida: em serverless cada instancia tem sua propria memoria,
 * entao o contador nao e global. Ele trava o ataque automatizado mais comum
 * (rajada na mesma instancia). Para uma barreira distribuida, configure uma
 * regra de firewall na Vercel limitando requisicoes a /api/login por IP.
 * ─────────────────────────────────────────────────────────────────────────── */
const RATE_LIMIT = {
  MAX_ATTEMPTS: 8,            // tentativas por janela
  WINDOW_MS: 10 * 60 * 1000,  // janela de 10 minutos
  BLOCK_MS: 15 * 60 * 1000    // bloqueio apos estourar o limite
};

const _attempts = new Map(); // chave -> { count, first, blockedUntil }

function clientIp(req) {
  const h = (req && req.headers) || {};
  const fwd = h['x-forwarded-for'] || h['X-Forwarded-For'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  if (h['x-real-ip'] || h['X-Real-IP']) return String(h['x-real-ip'] || h['X-Real-IP']);
  return 'desconhecido';
}

/**
 * Registra uma tentativa. Retorna { blocked, retryAfterSec }.
 * `key` identifica o cliente + o usuario tentado.
 */
function registerAttempt(key) {
  const now = Date.now();
  const rec = _attempts.get(key) || { count: 0, first: now, blockedUntil: 0 };

  if (rec.blockedUntil && rec.blockedUntil > now) {
    return { blocked: true, retryAfterSec: Math.ceil((rec.blockedUntil - now) / 1000) };
  }
  if (rec.blockedUntil && rec.blockedUntil <= now) {
    // Bloqueio expirou: zera e deixa passar.
    rec.count = 0;
    rec.first = now;
    rec.blockedUntil = 0;
  }
  if (now - rec.first > RATE_LIMIT.WINDOW_MS) {
    rec.count = 0;
    rec.first = now;
  }
  rec.count += 1;
  if (rec.count >= RATE_LIMIT.MAX_ATTEMPTS) {
    // Atingiu o limite: bloqueia daqui em diante. A tentativa que estoura o
    // limite ainda passa (para nao cortar uma senha correta no limite exato);
    // a PROXIMA ja vem bloqueada com 429.
    rec.blockedUntil = now + RATE_LIMIT.BLOCK_MS;
  }
  _attempts.set(key, rec);

  // Limpeza periodica para nao crescer sem limite.
  if (_attempts.size > 5000) {
    for (const [k, v] of _attempts) {
      if (v.blockedUntil < now && now - v.first > RATE_LIMIT.WINDOW_MS) _attempts.delete(k);
    }
  }
  return { blocked: false, retryAfterSec: 0 };
}

/** Limpa o contador (usado quando o login tem sucesso). */
function clearAttempts(key) {
  _attempts.delete(key);
}

/* ── Supabase (service_role) ──────────────────────────────────────────────── */

function serviceKey() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente no ambiente do deployment.');
  return k;
}

async function sbFetch(path, options) {
  const opts = options || {};
  const key = serviceKey();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: opts.method || 'GET',
    body: opts.body,
    headers: Object.assign(
      { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      opts.headers || {}
    )
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
  if (!res.ok) {
    const msg = (body && (body.message || body.error)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

/* ── Utilidades ──────────────────────────────────────────────────────────── */

function readBody(req) {
  let body = req && req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  return body && typeof body === 'object' ? body : {};
}

/** Extrai o token do header Authorization. */
function bearer(req) {
  const h = (req && req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (typeof h !== 'string') return '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

module.exports = {
  TABLES: TABLES,
  TABLE_LIST: TABLE_LIST,
  SESSION_TTL_MS: SESSION_TTL_MS,
  PBKDF2_ITERATIONS: PBKDF2_ITERATIONS,
  systemUsers: systemUsers,
  userCreds: userCreds,
  pbkdf2Hex: pbkdf2Hex,
  verifyPassword: verifyPassword,
  signToken: signToken,
  verifyToken: verifyToken,
  readSession: readSession,
  serviceKey: serviceKey,
  sbFetch: sbFetch,
  readBody: readBody,
  bearer: bearer,
  clientIp: clientIp,
  registerAttempt: registerAttempt,
  clearAttempts: clearAttempts,
  RATE_LIMIT: RATE_LIMIT
};
