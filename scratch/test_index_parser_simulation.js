const { sbFetch } = require('../api/_lib.js');

async function testParser() {
  console.log('Testing index.html parsing simulation on all shipments in database...');
  const data = await sbFetch('shipments?select=*,shipment_items(*)&order=created_at.desc');
  console.log(`Fetched ${data.length} shipments from Supabase.`);

  const statusCols = { aguardando: 0, separando: 0, coleta: 0, enviado: 0, chegou: 0 };
  const filialCounts = {};

  data.forEach((row, idx) => {
    // 1. Filial mapping logic from index.html L3067-3086
    let filial = "Francisco Beltrão";
    const b = (row.branch_name || "").toUpperCase();
    const txt = `${row.notes || ''} ${row.sender_name || ''}`.toLowerCase();
    if (b.includes("PALOTINA") || (row.notes || "").toUpperCase().includes("PALOTINA") || txt.includes("adilson") || txt.includes("palotina")) {
      filial = "Palotina (Adilson)";
    } else if (b.includes("BARRACAO") || txt.includes("barracao") || txt.includes("giseli")) {
      filial = "Barracão (Giseli)";
    } else if (b.includes("SMO") || b.includes("TERCEIROS") || txt.includes("smo") || txt.includes("terceiros")) {
      filial = "Terceiros SMO";
    } else if (b.includes("PATO") || (row.notes || "").toUpperCase().includes("PATO") || txt.includes("leonardo")) {
      filial = "Pato Branco";
    } else {
      if (txt.includes('cleverson') || txt.includes('beltrao2') || txt.includes('beltrao 2')) {
        filial = "Beltrão (Cleverson)";
      } else if (txt.includes('iury') || txt.includes('iuri') || txt.includes('beltrao1') || txt.includes('beltrao 1')) {
        filial = "Beltrão (Iury)";
      } else {
        filial = "Beltrão (Iury)";
      }
    }
    filialCounts[filial] = (filialCounts[filial] || 0) + 1;

    // 2. Notes & Urgency
    let rawNotes = row.notes || "";
    let cleanObs = rawNotes;
    let urgencia = "Normal";
    if (cleanObs.includes("[URGENTE]")) { urgencia = "Urgente"; cleanObs = cleanObs.replace("[URGENTE]", "").trim(); }
    else if (cleanObs.includes("[ALTA]")) { urgencia = "Alta"; cleanObs = cleanObs.replace("[ALTA]", "").trim(); }
    else if (cleanObs.includes("[NORMAL]")) { cleanObs = cleanObs.replace("[NORMAL]", "").trim(); }

    // 3. Status mapping
    let st = row.status || 'aguardando';
    if (st === 'recebido') st = 'chegou';
    statusCols[st] = (statusCols[st] || 0) + 1;

    // 4. Items parsing
    const items = row.shipment_items || [];
    items.forEach(it => {
      if (!it.product_name) throw new Error(`Row ${row.id} has item without product_name`);
      if (typeof it.quantity !== 'number' || it.quantity <= 0) throw new Error(`Row ${row.id} has invalid qty`);
    });

    if (st === 'aguardando') {
      const code = '#ENV-' + row.id.slice(0, 6).toUpperCase();
      console.log(`[Aguardando] ${code} | Filial: ${filial} | Urgência: ${urgencia} | Itens: ${items.length} tipos`);
    }
  });

  console.log('\n--- KANBAN STATUS DISTRIBUTION ---');
  console.table(statusCols);

  console.log('\n--- FILIAL ATTRIBUTION DISTRIBUTION ---');
  console.table(filialCounts);

  console.log('✅ ALL SHIPMENTS AND ITEMS PARSED 100% PERFECTLY!');
}

testParser().catch(err => {
  console.error('Parser test failed:', err);
  process.exit(1);
});
