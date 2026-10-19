/**
 * Test Suite: Ferramentas Separadas com Justificativa Obrigatória por Material
 * Testa solicitar.html e index.html
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Iniciando testes de separação de ferramentas e justificativa obrigatória...');

function extractScript(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const matches = [...html.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)];
  return matches.map(m => m[1]).join('\n;\n');
}

// ----------------------------------------------------
// 1. TESTES EM solicitar.html (Mobile Solicitante)
// ----------------------------------------------------
console.log('\n--- Testando solicitar.html (Mobile) ---');

const mobileCode = extractScript(path.join(__dirname, '..', 'solicitar.html'));

// Mock do ambiente do navegador para o script
const mockStorage = {};
const fakeLocalStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

const domElements = {};
function getOrCreateElement(id) {
  if (!domElements[id]) {
    domElements[id] = {
      id,
      value: '',
      innerText: '',
      innerHTML: '',
      classList: {
        classes: new Set(),
        add: function(c) { this.classes.add(c); },
        remove: function(c) { this.classes.delete(c); },
        contains: function(c) { return this.classes.has(c); }
      },
      style: {},
      disabled: false,
      appendChild: function() {},
      addEventListener: function() {},
      querySelectorAll: function() { return []; }
    };
  }
  return domElements[id];
}

const windowMock = {
  localStorage: fakeLocalStorage,
  sessionStorage: fakeLocalStorage,
  location: { reload: () => {} },
  addEventListener: () => {},
  document: {
    getElementById: (id) => getOrCreateElement(id),
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: (tag) => ({
      tagName: tag,
      classList: { add: () => {}, remove: () => {} },
      appendChild: () => {},
      style: {}
    }),
    body: { classList: { add: () => {}, remove: () => {} } }
  },
  navigator: {
    clipboard: { writeText: async () => {} },
    vibrate: () => {}
  },
  alert: (msg) => { windowMock.lastAlert = msg; },
  prompt: (msg, def) => windowMock.nextPromptResult !== undefined ? windowMock.nextPromptResult : def,
  showToast: () => {},
  lastAlert: null,
  nextPromptResult: undefined
};

const fakeSupabase = {
  createClient: () => ({
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => ({ select: () => Promise.resolve({ data: [{ id: 'mock-123' }], error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) })
    })
  })
};

const cryptoMock = {
  subtle: {
    digest: async (algo, data) => new ArrayBuffer(32)
  }
};

// Executa contexto isolado para solicitar.html
const vm = require('vm');
const mobileCtx = vm.createContext({
  window: windowMock,
  document: windowMock.document,
  localStorage: fakeLocalStorage,
  sessionStorage: fakeLocalStorage,
  navigator: windowMock.navigator,
  tailwind: { config: {} },
  supabase: fakeSupabase.createClient(),
  createClient: fakeSupabase.createClient,
  crypto: cryptoMock,
  alert: (m) => windowMock.alert(m),
  prompt: (m, d) => windowMock.prompt(m, d),
  console: console,
  setTimeout: (fn) => fn(),
  clearTimeout: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
  Date: Date,
  Math: Math,
  JSON: JSON,
  String: String,
  Array: Array,
  Object: Object,
  RegExp: RegExp,
  Set: Set,
  encodeURIComponent: encodeURIComponent,
  parseInt: parseInt
});

vm.runInContext(mobileCode, mobileCtx);

// Teste 1.1: Classificação de ferramentas e fibra óptica
console.log('1.1 Classificação de ferramentas e materiais de fibra:');
assert.strictEqual(mobileCtx.isItemTool('Alicate de Corte'), true, 'Alicate de Corte deve ser ferramenta');
assert.strictEqual(mobileCtx.isItemTool('Multímetro'), true, 'Multímetro deve ser ferramenta');
assert.strictEqual(mobileCtx.isItemTool('Furadeira de Impacto'), true, 'Furadeira deve ser ferramenta');
assert.strictEqual(mobileCtx.isItemTool('Serrinha'), true, 'Serrinha deve ser ferramenta');
assert.strictEqual(mobileCtx.isItemTool('Câmera Bullet UNV'), false, 'Câmera não é ferramenta');
assert.strictEqual(mobileCtx.isItemTool('Cabo de Rede'), false, 'Cabo de rede não é ferramenta');
assert.strictEqual(mobileCtx.isItemTool(null, 'EQUIPAMENTOS TÉCNICOS (FERRAMENTAS)'), true, 'Categoria de ferramentas deve ser reconhecida');

assert.strictEqual(mobileCtx.isItemFiberRestricted('Bobina de Cabo de Fibra'), true, 'Fibra deve ser restrita');
assert.strictEqual(mobileCtx.isItemFiberRestricted('Conector de Fibra'), true, 'Conector de fibra deve ser restrito');
assert.strictEqual(mobileCtx.isItemFiberRestricted('Kit de Fibra'), true, 'Kit de fibra deve ser restrito');
assert.strictEqual(mobileCtx.isItemFiberRestricted('Alicate de Bico'), false, 'Alicate de bico não é fibra');
console.log('✓ Classificação de materiais validada com sucesso.');

// Teste 1.2: Catálogo para Solicitantes (Ferramentas presentes, Fibra bloqueada)
console.log('1.2 Catálogo de materiais para solicitantes:');
mobileCtx.currentUser = 'cleverson1'; // Técnico Cleverson
const solicitanteCatalog = mobileCtx.getCatalogoForUser();
const catNames = solicitanteCatalog.map(c => c.categoria);
assert.ok(catNames.includes('EQUIPAMENTOS TÉCNICOS (FERRAMENTAS)'), 'Categoria de ferramentas DEVE estar presente para técnicos');
assert.ok(!catNames.includes('FIBRA'), 'Fibra óptica não deve ter categoria para técnicos');

// Verifica itens de ferramentas
const ferramentasCat = solicitanteCatalog.find(c => c.categoria === 'EQUIPAMENTOS TÉCNICOS (FERRAMENTAS)');
assert.ok(ferramentasCat.itens.includes('Alicate de Corte'), 'Alicate de Corte deve estar no catálogo do técnico');
assert.ok(ferramentasCat.itens.includes('Multímetro'), 'Multímetro deve estar no catálogo do técnico');
assert.strictEqual(ferramentasCat.isToolCategory, true, 'isToolCategory deve ser true');
console.log('✓ Categoria de Ferramentas disponível separadamente para técnicos.');

// Teste 1.3: Validação de Justificativa Obrigatória (Conferência / Envio)
console.log('1.3 Validação de justificativa obrigatória no carrinho:');
mobileCtx.mobileCart = {};
vm.runInContext('mobileCart = {}; mobileCartJustifications = {};', mobileCtx);

// Adiciona suprimento comum (não exige justificativa)
vm.runInContext('mobileCart["Câmera Bullet UNV"] = 2; mobileCart["Conector RJ45"] = 50;', mobileCtx);

// Configura elementos mockados de checkout
getOrCreateElement('checkout-solicitante').value = 'Cleverson';
getOrCreateElement('checkout-urgencia').value = 'Normal';
getOrCreateElement('checkout-branch-select').value = 'BELTRAO_CLEVERSON';
getOrCreateElement('checkout-obs').value = 'Instalação rotina';

windowMock.lastAlert = null;
vm.runInContext('openConferenciaModal();', mobileCtx);
assert.strictEqual(windowMock.lastAlert, null, 'Suprimentos comuns não devem exigir justificativa nem disparar alerta');
console.log('✓ Suprimentos normais avançam normalmente sem exigir justificativa.');

// Agora adiciona uma ferramenta SEM justificativa
vm.runInContext('mobileCart["Alicate de Corte"] = 1;', mobileCtx);
windowMock.lastAlert = null;
vm.runInContext('openConferenciaModal();', mobileCtx);
assert.ok(windowMock.lastAlert && windowMock.lastAlert.includes('JUSTIFICATIVA OBRIGATÓRIA PARA FERRAMENTAS'), 'Deve barrar ferramenta sem justificativa com alerta explicativo');
assert.ok(windowMock.lastAlert.includes('Alicate de Corte'), 'Alerta deve listar Alicate de Corte');
console.log('✓ Bloqueio de avanço sem justificativa funcionando rigorosamente.');

// Tenta justificativa curta (< 5 caracteres)
vm.runInContext('mobileCartJustifications["Alicate de Corte"] = "bad";', mobileCtx);
windowMock.lastAlert = null;
vm.runInContext('openConferenciaModal();', mobileCtx);
assert.ok(windowMock.lastAlert && windowMock.lastAlert.includes('JUSTIFICATIVA OBRIGATÓRIA PARA FERRAMENTAS'), 'Justificativa com menos de 5 caracteres deve ser rejeitada');

// Justificativa válida (>= 5 caracteres)
vm.runInContext('setToolJustification("Alicate de Corte", "O meu estragou, tentamos arrumar mas não deu certo");', mobileCtx);
windowMock.lastAlert = null;
vm.runInContext('openConferenciaModal();', mobileCtx);
assert.strictEqual(windowMock.lastAlert, null, 'Com justificativa preenchida (>= 5 chars), deve permitir avanço');
console.log('✓ Justificativa válida permitiu prosseguir para a conferência.');

// Teste 1.4: Persistência no LocalStorage
console.log('1.4 Persistência durável de carrinho e justificativas:');
vm.runInContext('saveMobileCartToStorage();', mobileCtx);
assert.ok(mockStorage['vigi_mobile_cart_justifications_v1'], 'Justificativas devem ser salvas no localStorage');
assert.ok(mockStorage['vigi_mobile_cart_justifications_v1'].includes('estragou'), 'Texto da justificativa deve estar salvo');

vm.runInContext('mobileCartJustifications = {}; loadMobileCartFromStorage();', mobileCtx);
const restoredJust = vm.runInContext('mobileCartJustifications["Alicate de Corte"];', mobileCtx);
assert.strictEqual(restoredJust, 'O meu estragou, tentamos arrumar mas não deu certo');
console.log('✓ Persistência e restauração do carrinho de ferramentas funcionando perfeitamente.');

// Teste 1.5: WhatsApp e Romaneio com Justificativa
console.log('1.5 Mensagem de WhatsApp e Romaneio A4:');
const fakeOrder = {
  id: 'ENV-123456',
  filial: 'Beltrão (Cleverson)',
  solicitante: 'Cleverson',
  urgencia: 'Normal',
  data: '19/10/2026 14:00',
  obs: 'Instalação rotina',
  itens: [
    { nome: 'Câmera Bullet UNV', qtd: 2, qtdOriginal: 2 },
    { nome: 'Alicate de Corte', qtd: 1, qtdOriginal: 1, justificativa: 'O meu estragou, tentamos arrumar mas não deu certo' }
  ],
  toolJustifications: {
    'Alicate de Corte': 'O meu estragou, tentamos arrumar mas não deu certo'
  }
};

const zapMsg = mobileCtx.buildOrderWhatsAppMessage(fakeOrder);
assert.ok(zapMsg.includes('Alicate de Corte'), 'WhatsApp deve conter a ferramenta');
assert.ok(zapMsg.includes('O meu estragou'), 'WhatsApp deve conter a justificativa do técnico');
console.log('✓ Mensagem de WhatsApp inclui justificativa da ferramenta.');

const romaneioHtml = mobileCtx.generateRomaneioPrintHTML(fakeOrder);
assert.ok(romaneioHtml.includes('Motivo da Ferramenta:'), 'Romaneio deve exibir motivo da ferramenta na tabela');
assert.ok(romaneioHtml.includes('Justificativas de Ferramentas Registradas pelo Técnico'), 'Romaneio deve exibir callout de justificativas');
console.log('✓ Romaneio de impressão A4 contém chamada e linhas com justificativa.');


// ----------------------------------------------------
// 2. TESTES EM index.html (Matriz Desktop)
// ----------------------------------------------------
console.log('\n--- Testando index.html (Matriz Desktop) ---');

const desktopCode = extractScript(path.join(__dirname, '..', 'index.html'));

const desktopCtx = vm.createContext({
  window: windowMock,
  document: windowMock.document,
  localStorage: fakeLocalStorage,
  sessionStorage: fakeLocalStorage,
  navigator: windowMock.navigator,
  tailwind: { config: {} },
  supabase: fakeSupabase.createClient(),
  createClient: fakeSupabase.createClient,
  crypto: cryptoMock,
  alert: (m) => windowMock.alert(m),
  prompt: (m, d) => windowMock.prompt(m, d),
  console: console,
  setTimeout: (fn) => fn(),
  clearTimeout: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
  Date: Date,
  Math: Math,
  JSON: JSON,
  String: String,
  Array: Array,
  Object: Object,
  RegExp: RegExp,
  Set: Set,
  encodeURIComponent: encodeURIComponent,
  parseInt: parseInt
});

vm.runInContext(desktopCode, desktopCtx);

console.log('2.1 Classificação e regras no painel Matriz:');
assert.strictEqual(desktopCtx.isItemTool('Alicate de Bico'), true);
assert.strictEqual(desktopCtx.isItemTool('Multímetro'), true);
assert.strictEqual(desktopCtx.isItemTool('DVR UNV 16CH'), false);
assert.strictEqual(desktopCtx.isItemFiberRestricted('Kit de Fibra'), true);

// Teste de Catálogo para solicitantes na Matriz
vm.runInContext('currentUser = "cleverson1";', desktopCtx);
const deskUserCat = vm.runInContext('getCatalogoForUser();', desktopCtx);
const deskCatNames = deskUserCat.map(c => c.categoria);
assert.ok(deskCatNames.includes('EQUIPAMENTOS TÉCNICOS (FERRAMENTAS)'), 'Ferramentas devem constar para solicitantes');

// Teste de validação em submitNewEnvio
console.log('2.2 Validação de justificativa em submitNewEnvio:');
vm.runInContext(`
  currentCart = {
    'DVR UNV 16CH': 1,
    'Alicate de Crimpar': 1
  };
  currentToolJustifications = {};
`, desktopCtx);

getOrCreateElement('req-filial').value = 'Beltrão (Cleverson)';
getOrCreateElement('req-solicitante').value = 'Cleverson';
getOrCreateElement('req-urgencia').value = 'Normal';
getOrCreateElement('req-obs').value = '';

windowMock.lastAlert = null;
vm.runInContext('submitNewEnvio();', desktopCtx);
assert.ok(windowMock.lastAlert && windowMock.lastAlert.includes('JUSTIFICATIVA OBRIGATÓRIA PARA FERRAMENTAS'), 'submitNewEnvio deve barrar ferramenta sem justificativa');

vm.runInContext('setModalToolJustification("Alicate de Crimpar", "Quebrou durante crimpagem de cabeamento na obra");', desktopCtx);
const deskJustVal = vm.runInContext('currentToolJustifications["Alicate de Crimpar"];', desktopCtx);
assert.strictEqual(deskJustVal, 'Quebrou durante crimpagem de cabeamento na obra');

// Teste de parsing em Supabase notes
console.log('2.3 Parsing de notas com justificativas:');
const sampleRow = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  branch_name: 'FRANCISCO BELTRAO PR',
  sender_name: 'Cleverson (cleverson1)',
  notes: '[NORMAL] [CLEVERSON] Atendimento condomínio [JUSTIFICATIVAS:{"Alicate de Crimpar":"Quebrou durante crimpagem"}]\n\n⚠️ JUSTIFICATIVAS DE FERRAMENTAS:\n• Alicate de Crimpar: "Quebrou durante crimpagem"',
  created_at: new Date().toISOString(),
  status: 'aguardando',
  shipment_items: [
    { id: '1', product_name: 'DVR UNV 16CH', quantity: 1 },
    { id: '2', product_name: 'Alicate de Crimpar', quantity: 1 }
  ]
};

// Executa simulação do mapa de loadSupabaseShipments
const justMatch = sampleRow.notes.match(/\[JUSTIFICATIVAS:(.*?)\]/);
assert.ok(justMatch, 'Regex deve encontrar tag [JUSTIFICATIVAS:...]');
const parsedJust = JSON.parse(justMatch[1]);
assert.strictEqual(parsedJust['Alicate de Crimpar'], 'Quebrou durante crimpagem');

const cleanNotes = sampleRow.notes
  .replace(/\[JUSTIFICATIVAS:(.*?)\]/g, '')
  .replace(/\n*⚠️ JUSTIFICATIVAS DE FERRAMENTAS:[\s\S]*$/g, '')
  .replace(/\[.*?\]/g, '')
  .trim();
assert.strictEqual(cleanNotes, 'Atendimento condomínio');
console.log('✓ Limpeza e extração de justificativas no banco funcionam perfeitamente.');

// Teste de Romaneio A4 no index.html
console.log('2.4 Romaneio A4 no index.html:');
const deskFakeOrder = {
  id: 'ENV-3FA85F',
  rawId: sampleRow.id,
  filial: 'Beltrão (Cleverson)',
  solicitante: 'Cleverson',
  urgencia: 'Normal',
  data: '19/10/2026 14:15',
  obs: cleanNotes,
  toolJustMap: parsedJust,
  itens: [
    { nome: 'DVR UNV 16CH', qtd: 1, qtdOriginal: 1 },
    { nome: 'Alicate de Crimpar', qtd: 1, qtdOriginal: 1, justificativa: parsedJust['Alicate de Crimpar'] }
  ]
};

const deskRomaneio = desktopCtx.generateRomaneioPrintHTML(deskFakeOrder);
assert.ok(deskRomaneio.includes('Motivo da Ferramenta:'), 'Romaneio do index.html deve conter motivo');
assert.ok(deskRomaneio.includes('Quebrou durante crimpagem'), 'Romaneio deve exibir o texto da justificativa');
assert.ok(deskRomaneio.includes('Justificativas de Ferramentas Registradas pelo Técnico'), 'Romaneio deve conter callout de justificativas');
console.log('✓ Romaneio do index.html validado com sucesso.');

// Teste de WhatsApp no index.html
console.log('2.5 WhatsApp no index.html:');
const deskZap = desktopCtx.buildWhatsAppRomaneio(deskFakeOrder);
assert.ok(deskZap.includes('Alicate de Crimpar'), 'WhatsApp deve listar a ferramenta');
assert.ok(deskZap.includes('Motivo: "Quebrou durante crimpagem"'), 'WhatsApp deve conter o motivo da ferramenta');
console.log('✓ WhatsApp do index.html validado com sucesso.');

console.log('\n🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!\n');
