/* =============================================================================
 * SISTEMA DE ENVIO VIGI — /api/login
 * ----------------------------------------------------------------------------
 * Endpoint serverless de autenticacao segura para o SISTEMA DE ENVIO VIGI.
 * Substitui a autenticacao puramente client-side (PBKDF2 no navegador) por
 * validacao no servidor.
 *
 * Fluxo:
 *   1. Recebe { username, password } no corpo JSON.
 *   2. Aplica rate limit por IP + usuario (8 tentativas / 10 min / 15 min de bloqueio).
 *   3. Confere a senha contra (salt, hash) PBKDF2-SHA256 guardados no ambiente.
 *   4. Emite um token assinado (HMAC-SHA256) valido por 8 horas.
 *
 * Nenhuma senha ou hash trafega ou esta gravada neste arquivo: tudo vem de
 * SISTEM_USER_CREDS / SISTEM_USERS no ambiente da Vercel.
 * ========================================================================== */

const lib = require('./_lib.js');

const GENERIC_ERROR = 'Usuario ou senha invalidos.';

module.exports = async function (req, res) {
  try {
    // Somente POST.
    if (!req || (req.method && req.method !== 'POST')) {
      res.status(405).json({ ok: false, error: 'Metodo nao permitido.' });
      return;
    }

    const body = lib.readBody(req);
    const username = String(body.username || '');
    const password = String(body.password || '');

    // ── RATE LIMIT NO SERVIDOR ──────────────────────────────────────────────
    const rateKey = lib.clientIp(req) + '|' + username.slice(0, 40);
    const rl = lib.registerAttempt(rateKey);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(rl.retryAfterSec));
      res.status(429).json({
        ok: false,
        error: 'Muitas tentativas. Aguarde ' + Math.ceil(rl.retryAfterSec / 60) + ' minuto(s) e tente novamente.'
      });
      return;
    }

    // Falha fechada: sem credenciais configuradas => sempre 401.
    const creds = lib.userCreds();
    const users = lib.systemUsers();
    if (!creds || Object.keys(creds).length === 0) {
      res.status(401).json({ ok: false, error: GENERIC_ERROR });
      return;
    }

    // Usuario inexistente ou senha vazia -> 401 generico.
    if (!creds[username] || !password) {
      // Pequeno atraso para achatar o tempo de resposta.
      await new Promise((r) => setTimeout(r, 300));
      res.status(401).json({ ok: false, error: GENERIC_ERROR });
      return;
    }

    // Confere a senha.
    if (!lib.verifyPassword(username, password)) {
      await new Promise((r) => setTimeout(r, 300));
      res.status(401).json({ ok: false, error: GENERIC_ERROR });
      return;
    }

    // Sucesso: limpa tentativas, emite token, devolve perfil do usuario.
    lib.clearAttempts(rateKey);
    const token = lib.signToken(username, lib.SESSION_TTL_MS);
    const u = users[username] || {};
    res.status(200).json({
      ok: true,
      user: username,
      name: u.name || username,
      role: u.role || 'filial',
      filial: u.filial || '',
      dbBranch: u.dbBranch || '',
      token: token,
      expiresAt: Date.now() + lib.SESSION_TTL_MS
    });
  } catch (e) {
    console.error('[login] erro interno:', e.message);
    res.status(500).json({ ok: false, error: 'Erro interno do servidor.' });
  }
};
