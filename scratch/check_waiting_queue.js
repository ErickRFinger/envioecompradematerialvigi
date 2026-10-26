const { sbFetch } = require('../api/_lib.js');

async function check() {
  const shipments = await sbFetch('shipments?select=*,shipment_items(*)&status=eq.aguardando&order=created_at.desc');
  console.log('Total orders in waiting queue (aguardando):', shipments.length);
  
  shipments.forEach((s, idx) => {
    const code = '#ENV-' + s.id.slice(0, 6).toUpperCase();
    const totalUnits = (s.shipment_items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
    console.log(`\n[${idx + 1}] ${code} | ${s.sender_name} | Filial: ${s.branch_name} | Status: ${s.status}`);
    console.log(`    Obs: ${s.notes}`);
    console.log(`    Itens: ${(s.shipment_items || []).length} tipos | ${totalUnits} unidades totais`);
    (s.shipment_items || []).forEach(it => {
      console.log(`      • ${it.quantity}x ${it.product_name} [${it.product_category}] (ID: ${it.product_id})`);
    });
  });
}

check().catch(console.error);
