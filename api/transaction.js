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
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      res.status(405).json({ ok: false, error: 'Metodo nao permitido.' });
      return;
    }

    const session = lib.readSession(req);
    if (!session) {
      res.status(401).json({ ok: false, error: GENERIC_ERROR });
      return;
    }

    const body = lib.readBody(req);
    const query = (req && req.query) || {};
    const table = (body.table || query.table || '').trim();
    if (!table || !lib.TABLE_LIST.includes(table)) {
      res.status(400).json({ ok: false, error: 'Tabela invalida.' });
      return;
    }

    // ── GET: listagem ──────────────────────────────────────────────────────
    if (method === 'GET') {
      let filter = '';
      if (table === lib.TABLES.SHIPMENTS && session.role !== 'admin' && session.dbBranch) {
        filter = '&branch_name=eq.' + encodeURIComponent(session.dbBranch);
      }
      if (table === lib.TABLES.ITEMS && (query.shipment_id || body.shipment_id)) {
        filter = '&shipment_id=eq.' + encodeURIComponent(query.shipment_id || body.shipment_id);
      }
      const selectCol = query.select ? encodeURIComponent(query.select) : '*';
      const orderCol = query.order ? query.order : 'created_at.desc';
      const limitVal = query.limit ? encodeURIComponent(query.limit) : '100';
      const path = table + '?select=' + selectCol + filter + '&order=' + orderCol + '&limit=' + limitVal;
      const data = await lib.sbFetch(path);
      res.status(200).json({ ok: true, data: Array.isArray(data) ? data : [] });
      return;
    }

    // ── POST: insert ───────────────────────────────────────────────────────
    if (method === 'POST') {
      let rows = body.rows || body.row || (Array.isArray(body) ? body : (typeof body === 'object' && Object.keys(body).length > 0 && !body.table ? [body] : null));
      if (!rows) {
        res.status(400).json({ ok: false, error: 'row invalido.' });
        return;
      }
      if (!Array.isArray(rows)) {
        rows = [rows];
      }
      // Forca a identidade do usuario autenticado para filiais
      if (table === lib.TABLES.SHIPMENTS && session.dbBranch) {
        rows.forEach(r => { if (typeof r === 'object' && r) r.branch_name = session.dbBranch; });
      }
      const payload = JSON.stringify(rows);
      const data = await lib.sbFetch(table, { method: 'POST', body: payload });
      res.status(200).json({ ok: true, data: Array.isArray(data) ? data : [] });
      return;
    }

    // ── PUT / PATCH: update ────────────────────────────────────────────────
    if (method === 'PUT' || method === 'PATCH') {
      let id = body.id || query.id;
      if (!id && query.eq) {
        const m = String(query.eq).match(/^id=eq\.(.+)$/);
        if (m) id = m[1];
      }
      if (!id && typeof query === 'object') {
        for (const k of Object.keys(query)) {
          if (k.startsWith('id=eq.')) id = k.replace('id=eq.', '');
        }
      }
      if (typeof id === 'string' && id.startsWith('eq.')) {
        id = id.slice(3);
      }
      if (!id) {
        res.status(400).json({ ok: false, error: 'id faltando.' });
        return;
      }
      let row = body.row !== undefined ? body.row : body;
      if (row && typeof row === 'object' && row.table !== undefined && row.row !== undefined) {
        row = row.row;
      }
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
      let ids = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
      if (ids.length === 0 && query.id) {
        let qId = String(query.id);
        if (qId.startsWith('eq.')) qId = qId.slice(3);
        ids = [qId];
      }
      if (ids.length === 0 && typeof query === 'object') {
        for (const k of Object.keys(query)) {
          if (k.startsWith('id=eq.')) ids.push(k.replace('id=eq.', ''));
          if (query[k] && typeof query[k] === 'string' && query[k].startsWith('eq.')) {
            if (k === 'id') ids.push(query[k].replace('eq.', ''));
          }
        }
      }
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