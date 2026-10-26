const { sbFetch } = require('../api/_lib.js');

async function run() {
  const shipments = await sbFetch('shipments?select=id,created_at,sender_name,branch_name,status,notes&order=created_at.desc');
  console.log(`Total shipments in DB: ${shipments.length}\n`);

  shipments.forEach((s, idx) => {
    const code = '#ENV-' + s.id.slice(0, 6).toUpperCase();
    const date = new Date(s.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const notesSummary = (s.notes || '').replace(/\n/g, ' ').slice(0, 80);
    console.log(`[${idx + 1}] ${code} | Status: ${s.status.padEnd(10)} | Data: ${date} | De: ${(s.sender_name || '').padEnd(25)} | Filial: ${(s.branch_name || '').padEnd(20)} | Obs: ${notesSummary}`);
  });
}

run().catch(console.error);
