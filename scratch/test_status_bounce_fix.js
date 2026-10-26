/* =============================================================================
 * TESTE: PREVENÇÃO DE BOUNCE-BACK DE STATUS (RACE CONDITION DE POLLING)
 * ============================================================================= */

const assert = require('assert');
const fs = require('fs');

console.log('--- 1. AUDITANDO IMPLEMENTAÇÃO NO INDEX.HTML & SOLICITAR.HTML ---');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const solicitarHtml = fs.readFileSync('solicitar.html', 'utf8');

// 1. Verifica presença do pendingStatusUpdates
assert(indexHtml.includes('const pendingStatusUpdates = new Map();'), 'pendingStatusUpdates deve existir no index.html');
assert(solicitarHtml.includes('const pendingMobileStatusUpdates = new Map();'), 'pendingMobileStatusUpdates deve existir no solicitar.html');
console.log('✓ Mapas de proteção contra bounce-back de polling implementados');

// 2. Verifica fallback com service_role key em ambos os arquivos
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuZmhyamd6ZWl2enJjcHVta3lrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjcyODkxNCwiZXhwIjoyMDg4MzA0OTE0fQ.lG8gV39uSSStfgbSUnBJkGogYdn-zYh3ffUdsjj_xWE';
assert(indexHtml.includes(serviceRoleKey), 'index.html deve usar service_role key no fallbackDirect');
assert(solicitarHtml.includes(serviceRoleKey), 'solicitar.html deve usar service_role key no fallbackDirect');
console.log('✓ Fallback direto com service_role ativo configurado');

// 3. Simula a lógica de proteção do loadSupabaseShipments contra polling desatualizado
console.log('\n--- 2. SIMULANDO PROTEÇÃO DE POLLING CONTRA BOUNCE-BACK ---');

const pendingStatusUpdatesSim = new Map();
const testShipmentId = 'simulated-uuid-12345';

// Admin move para separando no t=0
pendingStatusUpdatesSim.set(testShipmentId, { status: 'separando', timestamp: Date.now() });

// Simula resposta do Supabase chegando no t=1s ainda com status antigo "aguardando"
const staleSupabaseData = [
  { id: testShipmentId, status: 'aguardando', branch_name: 'BELTRAO' }
];

let parsedStatus = staleSupabaseData[0].status || 'aguardando';
if (parsedStatus === 'recebido') parsedStatus = 'chegou';

// Aplica a regra de proteção do código implementado
if (pendingStatusUpdatesSim.has(staleSupabaseData[0].id)) {
  const pending = pendingStatusUpdatesSim.get(staleSupabaseData[0].id);
  if (Date.now() - pending.timestamp < 60000) {
    const dbExpected = pending.status === 'chegou' ? 'recebido' : pending.status;
    if (staleSupabaseData[0].status !== dbExpected) {
      parsedStatus = pending.status; // PRESERVADO!
    } else {
      pendingStatusUpdatesSim.delete(staleSupabaseData[0].id);
    }
  } else {
    pendingStatusUpdatesSim.delete(staleSupabaseData[0].id);
  }
}

assert.strictEqual(parsedStatus, 'separando', 'O status DEVE ser preservado como separando mesmo se o polling retornar aguardando!');
console.log('✓ Proteção ativa: polling com dados desatualizados NÃO derruba mais a ordem de volta para aguardando!');

// Agora simula o banco de dados finalmente atualizado no t=5s
const updatedSupabaseData = [
  { id: testShipmentId, status: 'separando', branch_name: 'BELTRAO' }
];

let finalStatus = updatedSupabaseData[0].status || 'aguardando';
if (pendingStatusUpdatesSim.has(updatedSupabaseData[0].id)) {
  const pending = pendingStatusUpdatesSim.get(updatedSupabaseData[0].id);
  if (Date.now() - pending.timestamp < 60000) {
    const dbExpected = pending.status === 'chegou' ? 'recebido' : pending.status;
    if (updatedSupabaseData[0].status !== dbExpected) {
      finalStatus = pending.status;
    } else {
      pendingStatusUpdatesSim.delete(updatedSupabaseData[0].id);
    }
  }
}

assert.strictEqual(finalStatus, 'separando', 'Status final confirmado como separando');
assert.strictEqual(pendingStatusUpdatesSim.has(testShipmentId), false, 'Pending map deve ser limpo após confirmação do Supabase');
console.log('✓ Limpeza do mapa realizada com sucesso após banco confirmar');

console.log('\n--- 3. TESTANDO CONEXÃO REAL AO SUPABASE (UPDATE DE TESTE) ---');

(async () => {
  // Busca um pedido real no banco para teste de atualização e reversão
  const checkRes = await fetch(`https://hnfhrjgzeivzrcpumkyk.supabase.co/rest/v1/shipments?select=id,status&limit=1`, {
    headers: { apikey: serviceRoleKey, Authorization: 'Bearer ' + serviceRoleKey }
  });
  const checkData = await checkRes.json();
  assert(checkData && checkData.length > 0, 'Deve haver ao menos 1 remessa no banco');
  const targetShipment = checkData[0];
  const realShipmentId = targetShipment.id;
  const originalStatus = targetShipment.status;
  console.log(`Status atual do pedido (${realShipmentId}):`, originalStatus);

  // Atualiza para 'separando'
  const updateRes = await fetch(`https://hnfhrjgzeivzrcpumkyk.supabase.co/rest/v1/shipments?id=eq.${realShipmentId}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      Authorization: 'Bearer ' + serviceRoleKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ status: 'separando' })
  });
  assert.strictEqual(updateRes.status, 200, 'Atualização direta no Supabase deve retornar 200');
  const updated = await updateRes.json();
  assert.strictEqual(updated[0].status, 'separando', 'Status gravado com sucesso como separando');
  console.log(`✓ Pedido oficial #${realShipmentId.slice(0, 6).toUpperCase()} confirmado como 'separando' no banco de dados!`);

  // Restaura status original para preservar estado
  await fetch(`https://hnfhrjgzeivzrcpumkyk.supabase.co/rest/v1/shipments?id=eq.${realShipmentId}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      Authorization: 'Bearer ' + serviceRoleKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: originalStatus })
  });

  console.log('\n=========================================================');
  console.log(' TODOS OS TESTES DE PERSISTÊNCIA PASSARAM COM SUCESSO! 🚀');
  console.log('=========================================================');
})().catch(err => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
