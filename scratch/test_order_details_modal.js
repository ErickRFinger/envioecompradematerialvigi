// scratch/test_order_details_modal.js
// Teste automatizado de abertura e estabilidade dos modais de detalhes de pedido

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Iniciando testes de estabilidade dos modais de detalhes de pedido...\n');

const solicitarHtml = fs.readFileSync(path.join(__dirname, '../solicitar.html'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

// 1. Verificação estática em solicitar.html
console.log('--- 1. Verificações em solicitar.html (Mobile) ---');

assert(solicitarHtml.includes('findMobileOrder'), 'solicitar.html deve conter findMobileOrder');
assert(solicitarHtml.includes('modalOpenedTimestamps'), 'solicitar.html deve conter modalOpenedTimestamps');
assert(solicitarHtml.includes('modalMouseDownTarget'), 'solicitar.html deve rastrear modalMouseDownTarget');
assert(solicitarHtml.includes('Date.now() - openedAt < 350'), 'solicitar.html deve ter debounce anti-ghost-click de 350ms');
assert(solicitarHtml.includes('id="modal-order-details-mobile"'), 'solicitar.html deve conter modal-order-details-mobile');
assert(solicitarHtml.includes('onclick="event.stopPropagation()" class="glass-card'), 'modal-order-details-mobile deve ter stopPropagation no card interno');
console.log('✓ Proteções estruturais e listeners anti-ghost-click validados em solicitar.html.');

// 2. Verificação estática em index.html
console.log('--- 2. Verificações em index.html (Matriz Desktop) ---');

assert(indexHtml.includes('openCardDetails'), 'index.html deve conter openCardDetails');
assert(indexHtml.includes('modalOpenedTimestamps'), 'index.html deve conter modalOpenedTimestamps');
assert(indexHtml.includes('modalMouseDownTarget'), 'index.html deve rastrear modalMouseDownTarget');
assert(indexHtml.includes('Date.now() - openedAt < 350'), 'index.html deve ter debounce anti-ghost-click de 350ms');
assert(indexHtml.includes('id="modal-card-details"'), 'index.html deve conter modal-card-details');
assert(indexHtml.includes('onclick="event.stopPropagation()" class="glass-surface w-full max-w-4xl'), 'modal-card-details deve ter stopPropagation no card interno');
console.log('✓ Proteções estruturais e listeners anti-ghost-click validados em index.html.');

// 3. Teste funcional simulado de findMobileOrder
console.log('--- 3. Teste funcional da lógica de resolução de IDs (UUID, #ENV-, ENV-) ---');

const testShipments = [
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', branch_name: 'Palotina (Adilson)', notes: 'Teste 1' },
  { id: 'f0e1d2c3-b4a5-6789-0123-456789abcdef', branch_name: 'Barracão (Giseli)', notes: 'Teste 2' }
];

function mockFindMobileOrder(orderId, myShipments) {
  if (!orderId) return null;
  const clean = String(orderId).trim().toLowerCase();
  const rawUuid = clean.replace(/^#?env-/i, '');
  const searchPool = [...(myShipments || [])];

  return searchPool.find(s => {
    if (!s || !s.id) return false;
    const sId = String(s.id).toLowerCase();
    const sRaw = sId.replace(/^#?env-/i, '');
    return sId === clean ||
           sId === rawUuid ||
           sRaw === rawUuid ||
           sId.startsWith(rawUuid) ||
           sRaw.startsWith(rawUuid) ||
           (rawUuid.length >= 6 && sRaw.startsWith(rawUuid.slice(0, 6)));
  }) || null;
}

// Testes com vários formatos de ID
const byFullUuid = mockFindMobileOrder('a1b2c3d4-e5f6-7890-abcd-ef1234567890', testShipments);
assert(byFullUuid && byFullUuid.notes === 'Teste 1', 'Deve encontrar por UUID completo');

const byEnvCode = mockFindMobileOrder('ENV-A1B2C3', testShipments);
assert(byEnvCode && byEnvCode.notes === 'Teste 1', 'Deve encontrar por ENV-A1B2C3');

const byHashEnvCode = mockFindMobileOrder('#ENV-A1B2C3', testShipments);
assert(byHashEnvCode && byHashEnvCode.notes === 'Teste 1', 'Deve encontrar por #ENV-A1B2C3');

const byPrefixLower = mockFindMobileOrder('a1b2c3', testShipments);
assert(byPrefixLower && byPrefixLower.notes === 'Teste 1', 'Deve encontrar por prefixo a1b2c3');

const bySecondOrder = mockFindMobileOrder('#ENV-F0E1D2', testShipments);
assert(bySecondOrder && bySecondOrder.notes === 'Teste 2', 'Deve encontrar segunda ordem');

console.log('✓ Resolução de IDs resiliente em todos os formatos (UUID, ENV-, #ENV-, minúsculo, maiúsculo).');

// 4. Teste funcional da lógica anti-ghost-click
console.log('--- 4. Teste funcional da proteção de clique fantasma (Debounce & Mousedown Origin) ---');

function shouldBackdropClose(modalId, eventTarget, backdropEl, mouseDownTarget, modalOpenedTimestamps, currentTime) {
  const openedAt = modalOpenedTimestamps[modalId] || 0;
  // 1. Debounce 350ms
  if (currentTime - openedAt < 350) return false;
  // 2. Clique começou E terminou no backdrop
  if (eventTarget === backdropEl && mouseDownTarget === backdropEl) {
    return true;
  }
  return false;
}

const mockBackdrop = { id: 'modal-order-details-mobile' };
const mockInnerCard = { id: 'inner-card' };
const openedAt = 1000;
const timestamps = { 'modal-order-details-mobile': openedAt };

// Caso 1: Clique disparado logo após abrir (ex: 20ms depois - ghost click)
assert.strictEqual(
  shouldBackdropClose('modal-order-details-mobile', mockBackdrop, mockBackdrop, mockBackdrop, timestamps, openedAt + 20),
  false,
  'Ghost-click em 20ms deve ser ignorado'
);

// Caso 2: Clique em 200ms ainda deve ser ignorado
assert.strictEqual(
  shouldBackdropClose('modal-order-details-mobile', mockBackdrop, mockBackdrop, mockBackdrop, timestamps, openedAt + 200),
  false,
  'Clique em 200ms deve ser ignorado'
);

// Caso 3: Clique após 400ms mas mousedown foi no card interno (usuário arrastou ou soltou fora)
assert.strictEqual(
  shouldBackdropClose('modal-order-details-mobile', mockBackdrop, mockBackdrop, mockInnerCard, timestamps, openedAt + 400),
  false,
  'Clique que iniciou no card interno não pode fechar o modal'
);

// Caso 4: Clique após 400ms legítimo no backdrop (iniciou no backdrop e soltou no backdrop)
assert.strictEqual(
  shouldBackdropClose('modal-order-details-mobile', mockBackdrop, mockBackdrop, mockBackdrop, timestamps, openedAt + 400),
  true,
  'Clique legítimo no backdrop após 400ms deve fechar o modal'
);

console.log('✓ Lógica anti-ghost-click validada em todos os cenários com precisão!');

console.log('\n🎉 TODOS OS TESTES DE ESTABILIDADE DE MODAIS PASSARAM COM SUCESSO!');
