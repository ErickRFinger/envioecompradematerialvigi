/* =============================================================================
 * SISTEM ENVIO VIGI — /api/transaction
 * ----------------------------------------------------------------------------
 * Endpoint serverless de CRUD para as tabelas do SISTEM ENVIO VIGI
 * (compras, shipments, shipment_items).
 *
 * Substitui a chamada direta do navegador com a anon key:
 *   supabase.from('compras').insert(...)
 *   supabase.from('shipments').delete().eq(...)
 *
 * Agora o navegador chama ESTE endpoint com um Bearer token (HMAC, 8h) e
 * o servidor fala com o Supabase usando a service_role (BYPASSRLS).
 * O RLS do banco, quando aplicado, nega anon/authenticated por completo.
 * ========================================================================== */

const lib = require('./_lib.js');

const GENERIC_ERROR = 'Erro de autorizacao.';

module.exports = async function (req, res) {
  try {
    const method = req && req.method;
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
      res.status(405).json({ ok: false, error: 'Metodo nao permitido.' });
      return;
    }

    const session = lib.readSession(req);
    if (!session) {
      res.status(401).json({ ok: false, error: GENERIC_ERROR });
      return;
    }

    const body = lib.readBody(req);
    const table = (body.table || '').trim();
    if (!table || !lib.TABLE_LIST.includes(table)) {
      res.status(400).json({ ok: false, error: 'Tabela invalida.' });
      return;
    }

    // ── GET: listagem ──────────────────────────────────────────────────────
    if (method === 'GET') {
      const path = table + '?select=*&order=created_at.desc&limit=100';
      const data = await lib.sbFetch(path);
      res.status(200).json({ ok: true, data: Array.isArray(data) ? data : [] });
      return;
    }

    // ── POST: insert ───────────────────────────────────────────────────────
    if (method === 'POST') {
      const row = body.row;
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        res.status(400).json({ ok: false, error: 'row invalido.' });
        return;
      }
      // Forca a identidade do usuario autenticado.
      if (table === lib.TABLES.SHIPMENTS) {
        if (session.dbBranch) row.branch_name = session.dbBranch;
      }
      const payload = JSON.stringify([row]);
      const data = await lib.sbFetch(table, { method: 'POST', body: payload });
      res.status(200).json({ ok: true, data: Array.isArray(data) ? data : [] });
      return;
    }

    // ── PUT: update ────────────────────────────────────────────────────────
    if (method === 'PUT') {
      const id = body.id;
      if (!id) {
        res.status(400).json({ ok: false, error: 'id faltando.' });
        return;
      }
      const row = body.row;
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        res.status(400).json({ ok: false, error: 'row invalido.' });
        return;
      }
      const payload = JSON.stringify(row);
      const path = table + '?id=eq.' + encodeURIComponent(id);
      const data = await lib.sbFetch(path, { method: 'PATCH', body: payload });
      res.status(200).json({ ok: true, data: Array.isArray(data) ? data : [] });
      return;
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (method === 'DELETE') {
      const ids = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
      if (ids.length === 0) {
        res.status(400).json({ ok: false, error: 'id(s) invalido(s).' });
        return;
      }
      const inClause = ids.map((s) => 'eq.' + encodeURIComponent(s)).join(',');
      const path = table + '?id=in.(' + inClause + ')';
      const data = await lib.sbFetch(path, { method: 'DELETE' });
      res.status(200).json({ ok: true, data: Array.isArray(data) ? data : [] });
      return;
    }
  } catch (e) {
    console.error('[transaction] erro:', e.message);
    res.status(500).json({ ok: false, error: 'Erro interno do servidor.' });
  }
};