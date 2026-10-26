// scratch/test_all_filiais_submit.js
const assert = require('assert');
const lib = require('../api/_lib.js');
const transactionHandler = require('../api/transaction.js');

async function callApi(handler, req) {
  let status = 200;
  let json = null;
  const res = {
    status(s) { status = s; return res; },
    json(j) { json = j; }
  };
  await handler(req, res);
  return { status, json };
}

async function testAllBranches() {
  console.log('🧪 Iniciando auditoria completa de submissão para TODAS as filiais e Admins...\n');

  const usersToTest = [
    { username: 'beltrao1', name: 'Iury', role: 'solicitante', branch: 'BELTRAO' },
    { username: 'beltrao2', name: 'Cleverson', role: 'solicitante', branch: 'BELTRAO' },
    { username: 'palotina1', name: 'Adilson', role: 'solicitante', branch: 'PALOTINA' },
    { username: 'barracao1', name: 'Giseli', role: 'solicitante', branch: 'BARRACAO' },
    { username: 'pato1', name: 'Leonardo', role: 'solicitante', branch: 'PATO_BRANCO' },
    { username: 'smo1', name: 'Terceiros SMO', role: 'solicitante', branch: 'SMO' },
    { username: 'deivid', name: 'Deivid', role: 'admin', branch: 'MATRIZ' },
    { username: 'gabriely', name: 'Gabriely', role: 'admin', branch: 'MATRIZ' },
    { username: 'thiago', name: 'Thiago', role: 'admin', branch: 'MATRIZ' },
    { username: 'erick', name: 'Erick', role: 'admin', branch: 'MATRIZ' }
  ];

  for (const u of usersToTest) {
    console.log(`--- Testando usuário: ${u.username} (${u.name} - ${u.role}) ---`);

    // 1. Gera token HMAC
    const token = lib.signToken(u.username);
    assert(token, `Token deve ser gerado para ${u.username}`);

    // 2. Insere pedido
    const shipReq = {
      method: 'POST',
      query: { table: 'shipments' },
      headers: { authorization: 'Bearer ' + token },
      body: [{
        branch_name: u.branch,
        sender_name: `${u.name} (${u.username})`,
        driver_name: null,
        notes: `[NORMAL] Teste automatizado de auditoria para ${u.name}`,
        status: 'aguardando'
      }]
    };

    const shipRes = await callApi(transactionHandler, shipReq);
    assert.strictEqual(shipRes.status, 200, `Status HTTP deve ser 200 para ${u.username}`);
    assert(shipRes.json && shipRes.json.ok, `Resposta ok: true esperada para ${u.username}`);
    assert(Array.isArray(shipRes.json.data) && shipRes.json.data.length > 0, `Data array esperado para ${u.username}`);

    const shipment = shipRes.json.data[0];
    assert(shipment.id, `ID do pedido deve existir para ${u.username}`);
    console.log(`  ✓ Pedido criado com sucesso! ID: ${shipment.id}`);

    // 3. Insere itens
    const itemsReq = {
      method: 'POST',
      query: { table: 'shipment_items' },
      headers: { authorization: 'Bearer ' + token },
      body: [
        {
          shipment_id: shipment.id,
          product_id: 'conector-rj45',
          product_name: 'Conector RJ45',
          product_category: 'CONECTORES E VÍDEO',
          quantity: 20
        }
      ]
    };

    const itemsRes = await callApi(transactionHandler, itemsReq);
    assert.strictEqual(itemsRes.status, 200, `Itens HTTP deve ser 200 para ${u.username}`);
    assert(itemsRes.json && itemsRes.json.ok, `Itens ok: true para ${u.username}`);
    assert(itemsRes.json.data && itemsRes.json.data.length === 1, `1 item inserido para ${u.username}`);
    console.log(`  ✓ Item vinculado com sucesso! ID: ${itemsRes.json.data[0].id}`);

    // 4. Limpeza
    const delItems = {
      method: 'DELETE',
      query: { table: 'shipment_items', shipment_id: shipment.id },
      headers: { authorization: 'Bearer ' + token },
      body: {}
    };
    await callApi(transactionHandler, delItems);

    const delShip = {
      method: 'DELETE',
      query: { table: 'shipments', id: shipment.id },
      headers: { authorization: 'Bearer ' + token },
      body: {}
    };
    await callApi(transactionHandler, delShip);
    console.log(`  ✓ Limpeza concluída para ${u.username}.\n`);
  }

  console.log('🎉 AUDITORIA COMPLETA: TODAS AS 10 FILIAIS E ADMINS TESTADOS COM 100% DE SUCESSO!');
}

testAllBranches().catch(err => {
  console.error('❌ Falha na auditoria:', err);
  process.exit(1);
});
