/* =============================================================================
 * SISTEMA DE ENVIO VIGI — Biblioteca do servidor (Serverless Functions)
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

/* ── Dados de configuracao (Com fallbacks seguros canonicos) ─────────────── */

const DEFAULT_SYSTEM_USERS = {
  "erick":     { username: "erick", name: "Erick", role: "admin", filial: "Todas as Filiais", dbBranch: "MATRIZ", email: "erick@vigi.com.br" },
  "klaus":     { username: "klaus", name: "Klaus", role: "admin", filial: "Todas as Filiais", dbBranch: "MATRIZ", email: "klaus@vigi.com.br" },
  "daniel":    { username: "daniel", name: "Daniel", role: "admin", filial: "Todas as Filiais", dbBranch: "MATRIZ", email: "daniel@vigi.com.br" },
  "thiago":    { username: "thiago", name: "Thiago", role: "admin", filial: "Todas as Filiais", dbBranch: "MATRIZ", email: "thiago@vigi.com.br" },
  "deivid":    { username: "deivid", name: "Deivid", role: "admin", filial: "Todas as Filiais", dbBranch: "MATRIZ", email: "deivid@vigi.com.br" },
  "gabriely":  { username: "gabriely", name: "Gabriely", role: "admin", filial: "Todas as Filiais", dbBranch: "MATRIZ", email: "gabriely@vigi.com.br" },
  "beltrao1":  { username: "beltrao1", name: "Iury", role: "solicitante", filial: "Francisco Beltrão", dbBranch: "BELTRAO" },
  "beltrao2":  { username: "beltrao2", name: "Cleverson", role: "solicitante", filial: "Francisco Beltrão", dbBranch: "BELTRAO" },
  "palotina1": { username: "palotina1", name: "Adilson", role: "solicitante", filial: "Palotina", dbBranch: "PALOTINA" },
  "barracao1": { username: "barracao1", name: "Giseli", role: "solicitante", filial: "Barracão", dbBranch: "BARRACAO" },
  "pato1":     { username: "pato1", name: "Leonardo", role: "solicitante", filial: "Pato Branco", dbBranch: "PATO_BRANCO" },
  "smo1":      { username: "smo1", name: "Terceiros SMO", role: "solicitante", filial: "São Miguel do Oeste", dbBranch: "SMO" }
};

const DEFAULT_USER_CREDS = {
  "erick":     { salt: "7be481ed9fb618f95a6cfeba1c3cef3b", hash: "c61968e16f402b9639910f396d06781ed469b4b5a76c7335f1ea0b65e1651234" },
  "klaus":     { salt: "8ca133fc01f89ba1f7e8eead04dc9a29", hash: "708ad69969f6470da99c4ac2f07062a6f704f35d86e95c74508dd377e818a56b" },
  "daniel":    { salt: "a04b5ef2cbc0c00bf8b2dc360ff671cc", hash: "ea09e9c6cc04220248303aa29209a024c479e9dd902c4ac13eccc35a2ce78438" },
  "thiago":    { salt: "4e49d100904f73e12e2f1740a0174f7b", hash: "b22d49405229b5f0301b63fa8511325329fb911dc275520b7f895d8ae5701d7e" },
  "deivid":    { salt: "84f4da00575802bd31ddc75957e7fc4f", hash: "9dc537a9fa49dce138b8a9d2e1113ba2b0216cf91293efe25bd1427fd5eb1b80" },
  "gabriely":  { salt: "f9914a72325f891227fa2961168e2ab4", hash: "060c0e1ec87faf389268cb3dd54bb468567ce98bc243aa7452c05884458edb3b" },
  "beltrao1":  { salt: "c69c8c773552ddb436b6b24d72e2a9b0", hash: "cbce7c8233bac9b2d3f805a95ef44109e299435e21403dc9f06ca8e80b7b0afe" },
  "beltrao2":  { salt: "7092129315c1d9a3e9d75c11072e6532", hash: "cb663dae2103ff11fe7fa1c6f9be300ae6a74bf42e683dd90ddf07ebda03a709" },
  "palotina1": { salt: "e8239a667adba7a6c85df2102652a020", hash: "6b627bb57e59874bfd1451540cff741d42463c7eeac8e8a1ba614b1305da0071" },
  "barracao1": { salt: "54f3d9d31957adc0a93a6d7b02012dc7", hash: "0daff8bc1a5a03ec2cb89e2bca8e9dc39cf90fb5e1dce6f5a8fb7c123040ee05" },
  "pato1":     { salt: "9338cf714648e087fb463f25031fe0ae", hash: "af4e4373002de02de7fa3b4b2907c7e760bf52f874be361f97fa2992ed8af593" },
  "smo1":      { salt: "35908a8f6a44c209cc7e699b0901466f", hash: "fa64314941a683d025124f267f6fe0b380f223d430c20da3511a09901bef2e1c" }
};

const DEFAULT_SESSION_SECRET = 'vigi_secure_secret_hmac_2026_super_hardened_token_key_abcdef1234567890';
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuZmhyamd6ZWl2enJjcHVta3lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3Mjg5MTQsImV4cCI6MjA4ODMwNDkxNH0.qWKErHq6vCPRWdDfrnngY8fPiJ05VR586U0GzZ3vmrI';

/**
 * Mapa de usuarios com papel e filial. Vem do ambiente (SISTEM_USERS) ou fallback padrao.
 */
function systemUsers() {
  const raw = process.env.SISTEM_USERS;
  if (!raw || !raw.trim()) {
    return DEFAULT_SYSTEM_USERS;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : DEFAULT_SYSTEM_USERS;
  } catch (e) {
    console.error('[_lib] SISTEM_USERS invalido (JSON):', e.message);
    return DEFAULT_SYSTEM_USERS;
  }
}

/**
 * Pares (salt, hash) PBKDF2 por usuario. Vem do ambiente (SISTEM_USER_CREDS) ou fallback padrao.
 */
function userCreds() {
  const raw = process.env.SISTEM_USER_CREDS;
  if (!raw || !raw.trim()) {
    return DEFAULT_USER_CREDS;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : DEFAULT_USER_CREDS;
  } catch (e) {
    console.error('[_lib] SISTEM_USER_CREDS invalido (JSON):', e.message);
    return DEFAULT_USER_CREDS;
  }
}

function sessionSecret() {
  const s = process.env.SISTEM_SESSION_SECRET || DEFAULT_SESSION_SECRET;
  if (!s || s.length < 32) {
    return DEFAULT_SESSION_SECRET;
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
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_SERVICE_ROLE_KEY;
  if (!k) return DEFAULT_SUPABASE_SERVICE_ROLE_KEY;
  return k;
}

async function sbFetch(path, options) {
  const opts = options || {};
  const key = serviceKey();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: opts.method || 'GET',
    body: opts.body,
    headers: Object.assign(
      { 
        apikey: key, 
        Authorization: `Bearer ${key}`, 
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
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
