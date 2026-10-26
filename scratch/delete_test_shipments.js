const { sbFetch } = require('../api/_lib.js');

const TEST_SHIPMENT_IDS = [
  'dab67fad-a034-46e4-895c-f0ab82ad770d', // SMO test
  'a1a8e01b-e5ab-49eb-af6b-14ab282f456f', // Cleverson test
  '51d658fd-0e6b-4ffb-930b-431ac8df0b67', // Leonardo test
  'afcb9aed-2bd8-4463-a6b8-a47cb4a7ee69', // Giseli test
  '3b0c3c4c-cbfc-4ee0-84d7-b28b8a387a26'  // Adilson test
];

async function deleteTests() {
  console.log(`Excluindo os 5 pedidos de teste criados anteriormente...`);

  for (const id of TEST_SHIPMENT_IDS) {
    // 1. Exclui itens vinculados
    const delItems = await sbFetch(`shipment_items?shipment_id=eq.${id}`, {
      method: 'DELETE'
    });
    console.log(`  ✓ Itens do pedido ${id} excluídos`);

    // 2. Exclui o shipment
    const delShip = await sbFetch(`shipments?id=eq.${id}`, {
      method: 'DELETE'
    });
    console.log(`  ✓ Pedido ${id} (#ENV-${id.slice(0, 6).toUpperCase()}) excluído com sucesso`);
  }

  console.log('\n--- VERIFICANDO FILA DE ESPERA (AGUARDANDO) APÓS EXCLUSÃO ---');
  const remaining = await sbFetch('shipments?select=*,shipment_items(*)&status=eq.aguardando');
  console.log(`Total restante na fila de espera: ${remaining.length}`);
  remaining.forEach(s => {
    console.log(`ID: ${s.id} (#ENV-${s.id.slice(0, 6).toUpperCase()}) | De: ${s.sender_name} | Filial: ${s.branch_name} | Obs: ${s.notes}`);
    console.log(`Itens (${s.shipment_items.length}):`, s.shipment_items.map(it => `${it.quantity}x ${it.product_name}`).join(', '));
  });
}

deleteTests().catch(console.error);
