const fs = require('fs');
const { sbFetch } = require('../api/_lib.js');

const html = fs.readFileSync('solicitar.html', 'utf8');
const match = html.match(/const CATALOGO_MATERIAIS = (\[[\s\S]*?\]);/);
if (!match) {
  console.error('Could not find CATALOGO_MATERIAIS');
  process.exit(1);
}
const cat = eval(match[1]);

const allItems = new Map();
cat.forEach(c => {
  c.itens.forEach(it => allItems.set(it.toLowerCase().trim(), { name: it, category: c.categoria }));
});

console.log(`Loaded ${allItems.size} catalog items from CATALOGO_MATERIAIS.`);

// List of allowed connectors to ensure compliance
const candidateOrders = [
  {
    branch_name: 'PALOTINA PR',
    sender_name: 'Adilson (palotina1)',
    notes: '[ALTA] [PALOTINA] Reposição de insumos para atendimento de novos clientes rurais',
    status: 'aguardando',
    items: [
      { name: 'Câmera Bullet UNV ColorVu', qty: 8 },
      { name: 'DVR UNV 8CH', qty: 2 },
      { name: 'Fonte 12V 3.0A', qty: 8 },
      { name: 'Par de Balun', qty: 8 },
      { name: 'Caixinha de Passagem Vedada', qty: 15 },
      { name: 'Bobina de Cabo Coaxial', qty: 2 }
    ]
  },
  {
    branch_name: 'BARRACAO PR',
    sender_name: 'Giseli (Barracão) (barracao1)',
    notes: '[NORMAL] [GISELI] Materiais para expansão de cabeamento e pontos de monitoramento comercial',
    status: 'aguardando',
    items: [
      { name: 'Câmera Dome UNV Dual Light', qty: 12 },
      { name: 'DVR UNV 16CH', qty: 1 },
      { name: 'Conector RJ45', qty: 50 },
      { name: 'Caixa de Cabo de Rede', qty: 2 },
      { name: 'Conector Wago (emenda de energia)', qty: 40 },
      { name: 'Fita Isolante Preta', qty: 5 }
    ]
  },
  {
    branch_name: 'PATO BRANCO PR',
    sender_name: 'Leonardo (Pato Branco) (pato1)',
    notes: '[NORMAL] [PATO BRANCO] Instalação de novo projeto CFTV IP em condomínio residencial',
    status: 'aguardando',
    items: [
      { name: 'Câmera IP Bullet UNV', qty: 6 },
      { name: 'Câmera IP Dome UNV', qty: 4 },
      { name: 'DVR UNV 8CH', qty: 1 },
      { name: 'Par de Injetor POE', qty: 6 },
      { name: 'Caixinha de Passagem Branca', qty: 10 }
    ]
  },
  {
    branch_name: 'FRANCISCO BELTRAO PR',
    sender_name: 'Cleverson (Beltrão) (beltrao2)',
    notes: '[ALTA] [CLEVERSON] Atendimento preventivo e substituição em pontos críticos',
    status: 'aguardando',
    items: [
      { name: 'Câmera Hik Robotizada Sirene', qty: 2 },
      { name: 'Câmera Bullet UNV Dual Light', qty: 6 },
      { name: 'DVR Hikvision 8CH', qty: 2 },
      { name: 'Conector BNC', qty: 30 },
      { name: 'Conector P4', qty: 30 },
      { name: 'Régua de Tomadas 6 posições', qty: 4 }
    ]
  },
  {
    branch_name: 'TERCEIROS SMO',
    sender_name: 'Terceiros SMO (smo1)',
    notes: '[NORMAL] [TERCEIROS SMO] Reposição de estoque técnico conveniado SMO',
    status: 'aguardando',
    items: [
      { name: 'Câmera Dome UNV ColorVu', qty: 10 },
      { name: 'DVR UNV 4CH', qty: 3 },
      { name: 'Fonte 12V 2.5A', qty: 10 },
      { name: 'Par de Balun', qty: 10 },
      { name: 'Plaquinha VIGI', qty: 20 },
      { name: 'Presilha de Nylon 20cm', qty: 100 }
    ]
  }
];

// Helper to create slug id from product name
function slugify(text) {
  return text.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function run() {
  console.log('\n--- 1. VALIDATING CANDIDATE ORDERS AGAINST CATALOG ---');
  let hasError = false;

  for (let i = 0; i < candidateOrders.length; i++) {
    const o = candidateOrders[i];
    console.log(`\nPedido #${i + 1}: ${o.sender_name} (${o.branch_name})`);
    for (const it of o.items) {
      const match = allItems.get(it.name.toLowerCase().trim());
      if (!match) {
        console.error(`  ❌ ITEM NÃO ENCONTRADO NO CATÁLOGO: "${it.name}"`);
        hasError = true;
      } else {
        it.exactName = match.name;
        it.category = match.category;
        it.productId = slugify(match.name);
        console.log(`  ✓ ${it.qty}x ${it.exactName} [${it.category}] (ID: ${it.productId})`);
      }
    }
  }

  if (hasError) {
    console.error('\nErro de validação no catálogo. Abortando inserção.');
    process.exit(1);
  }

  console.log('\n--- 2. INSERINDO OS 5 PEDIDOS NO SUPABASE COM TRANSAÇÃO SEGURA ---');

  const createdShipments = [];

  for (let i = 0; i < candidateOrders.length; i++) {
    const o = candidateOrders[i];
    
    // Insere shipment
    const shipPayload = {
      branch_name: o.branch_name,
      sender_name: o.sender_name,
      notes: o.notes,
      status: o.status
    };

    const insertedShipment = await sbFetch('shipments', {
      method: 'POST',
      body: JSON.stringify(shipPayload)
    });

    const shipRecord = Array.isArray(insertedShipment) ? insertedShipment[0] : insertedShipment;
    if (!shipRecord || !shipRecord.id) {
      throw new Error(`Falha ao criar shipment para ${o.sender_name}: ` + JSON.stringify(insertedShipment));
    }

    const shipId = shipRecord.id;
    console.log(`✓ Shipment #${i + 1} criado: ID ${shipId} (#ENV-${shipId.slice(0, 6).toUpperCase()})`);

    // Prepara e insere itens
    const itemsPayload = o.items.map(it => ({
      shipment_id: shipId,
      product_id: it.productId,
      product_name: it.exactName,
      product_category: it.category,
      quantity: it.qty
    }));

    const insertedItems = await sbFetch('shipment_items', {
      method: 'POST',
      body: JSON.stringify(itemsPayload)
    });

    console.log(`  ✓ ${itemsPayload.length} itens inseridos em shipment_items`);
    createdShipments.push({
      id: shipId,
      code: `#ENV-${shipId.slice(0, 6).toUpperCase()}`,
      branch: o.branch_name,
      sender: o.sender_name,
      notes: o.notes,
      itemCount: itemsPayload.length
    });
  }

  console.log('\n--- 3. SUCESSO! 5 PEDIDOS ADICIONADOS NA FILA DE ESPERA (AGUARDANDO) ---');
  console.table(createdShipments);
}

run().catch(err => {
  console.error('Falha na execução:', err);
  process.exit(1);
});
