// scratch/test_transaction_insert.js
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

async function run() {
  console.log('🧪 Testando fluxo completo de inserção de pedido via /api/transaction...\n');

  // 1. Gerar token de Iury (Beltrão)
  const token = lib.signToken('beltrao1');
  assert(token, 'Token deve ser gerado');
  console.log('✓ Token HMAC gerado com sucesso para beltrao1 (Iury).');

  // 2. Inserir Shipment
  const shipReq = {
    method: 'POST',
    query: { table: 'shipments' },
    headers: { authorization: 'Bearer ' + token },
    body: [{
      branch_name: 'BELTRAO',
      sender_name: 'Iury (Beltrão)',
      driver_name: null,
      notes: '[NORMAL] So manda se for camera bulet',
      status: 'aguardando'
    }]
  };

  const shipRes = await callApi(transactionHandler, shipReq);
  assert.strictEqual(shipRes.status, 200, 'Status deve ser 200');
  assert(shipRes.json && shipRes.json.ok, 'Resposta deve ter ok: true');
  assert(Array.isArray(shipRes.json.data) && shipRes.json.data.length > 0, 'data deve conter a linha inserida');

  const createdShipment = shipRes.json.data[0];
  assert(createdShipment.id, 'Shipment deve conter ID gerado pelo banco');
  assert.strictEqual(createdShipment.branch_name, 'BELTRAO', 'branch_name deve ser BELTRAO');
  console.log('✓ Shipment criado com sucesso! ID:', createdShipment.id);

  // 3. Inserir Itens do Shipment (ex: Câmera Bullet e DVR do screenshot)
  const itemsReq = {
    method: 'POST',
    query: { table: 'shipment_items' },
    headers: { authorization: 'Bearer ' + token },
    body: [
      {
        shipment_id: createdShipment.id,
        product_id: 'camera-bullet-unv-colorvu',
        product_name: 'Câmera Bullet UNV ColorVu',
        product_category: 'CÂMERAS',
        quantity: 10
      },
      {
        shipment_id: createdShipment.id,
        product_id: 'dvr-unv-4ch',
        product_name: 'DVR UNV 4CH',
        product_category: 'GRAVADORES (DVRs)',
        quantity: 5
      }
    ]
  };

  const itemsRes = await callApi(transactionHandler, itemsReq);
  assert.strictEqual(itemsRes.status, 200, 'Status deve ser 200');
  assert(itemsRes.json && itemsRes.json.ok, 'Itens devem retornar ok: true');
  assert(Array.isArray(itemsRes.json.data) && itemsRes.json.data.length === 2, 'Deve retornar os 2 itens inseridos');
  console.log('✓ 2 Itens inseridos com sucesso em shipment_items vinculados ao pedido!');

  // 4. Limpeza (deletar itens e shipment criados para não sujar banco de produção)
  const delItemsReq = {
    method: 'DELETE',
    query: { table: 'shipment_items', shipment_id: createdShipment.id },
    headers: { authorization: 'Bearer ' + token },
    body: {}
  };
  await callApi(transactionHandler, delItemsReq);

  const delShipReq = {
    method: 'DELETE',
    query: { table: 'shipments', id: createdShipment.id },
    headers: { authorization: 'Bearer ' + token },
    body: {}
  };
  await callApi(transactionHandler, delShipReq);
  console.log('✓ Limpeza concluída no Supabase.');

  console.log('\n🎉 TESTE DE TRANSAÇÃO E INSERÇÃO PASSOU COM 100% DE SUCESSO!');
}

run().catch(err => {
  console.error('❌ Falha no teste:', err);
  process.exit(1);
});
