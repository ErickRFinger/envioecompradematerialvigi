/**
 * Test Suite: Controle de Acesso à Aba de Ferramentas & Justificativa Obrigatória
 * Regras Testadas:
 * 1. SOMENTE Iury (beltrao1/iury), Giseli (barracao1/giseli) e Adilson (palotina1/adilson) + Admins podem ver e pedir ferramentas.
 * 2. CLEVERSON (beltrao2/cleverson), LEONARDO (pato1/leonardo) e TÉCNICOS DE SMO (smo1/smo) NÃO PODEM ter acesso à aba de ferramentas.
 * 3. Para quem tem acesso (Iury, Giseli, Adilson), cada ferramenta exige justificativa obrigatória (>= 5 caracteres).
 * 4. Suprimentos normais permanecem livres para todos sem justificativa.
 * 5. Fibra óptica permanece restrita a administradores.
 * 6. SUÍTE DE SEGURANÇA (ver scratch/test_security.js): senhas, backdoors de URL,
 *    XSS, sessão e troca de perfil protegida por senha.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('🧪 Iniciando testes de permissões e justificativas de ferramentas...');

function extractScript(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const matches = [...html.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)];
  return matches.map(m => m[1]).join('\n;\n');
}

// ----------------------------------------------------
// Mocks do Navegador
// ----------------------------------------------------
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
      appendChild: function(child) {
        if (id === 'toast-container' && child) {
          // showToast agora injeta a mensagem via textContent (anti-XSS),
          // então reconstruímos o texto a partir dos filhos anexados.
          const childTexts = (child._children || []).map(c => c.textContent || '');
          const full = [child.innerHTML || ''].concat(childTexts).join(' ').trim();
          windowMock.lastToast = { msg: full, text: childTexts.join(' ') };
        }
      },
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
      _children: [],
      textContent: '',
      innerHTML: '',
      appendChild: function(child) { this._children.push(child); },
      style: {},
      remove: () => {}
    }),
    body: { classList: { add: () => {}, remove: () => {} } }
  },
  navigator: {
    clipboard: { writeText: async () => {} },
    vibrate: () => {}
  },
  alert: (msg) => { windowMock.lastAlert = msg; },
  prompt: (msg, def) => windowMock.nextPromptResult !== undefined ? windowMock.nextPromptResult : def,
  showToast: (msg, type) => { windowMock.lastToast = { msg, type }; },
  lastAlert: null,
  lastToast: null,
  nextPromptResult: undefined
};

const fakeSupabase = {
  createClient: () => ({
    from: () => ({
      select: () => Promise.resolve({ data: [{ id: 'mock-123' }], error: null }),
      insert: () => ({ select: () => Promise.resolve({ data: [{ id: 'mock-123' }], error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) })
    })
  })
};

windowMock.supabase = fakeSupabase;

const cryptoMock = {
  subtle: {
    digest: async (algo, data) => new ArrayBuffer(32)
  }
};

function createSandbox(scriptCode) {
  const ctx = vm.createContext({
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
  vm.runInContext(scriptCode, ctx);
  return ctx;
}

// ====================================================
// 1. TESTES EM solicitar.html (Mobile Solicitante)
// ====================================================
console.log('\n--- Testando solicitar.html (Mobile) ---');
const mobileCode = extractScript(path.join(__dirname, '..', 'solicitar.html'));
const mobileCtx = createSandbox(mobileCode);

// 1.1 Verificação da função canUserRequestTools
console.log('1.1 canUserRequestTools(): Matriz de permissão rigorosa');
// Permitidos: Iury, Giseli, Adilson e Admins
assert.strictEqual(mobileCtx.canUserRequestTools('beltrao1'), true, 'Iury (beltrao1) DEVE ter permissão de ferramentas');
assert.strictEqual(mobileCtx.canUserRequestTools('iury'), true, 'Iury alias DEVE ter permissão de ferramentas');
assert.strictEqual(mobileCtx.canUserRequestTools('barracao1'), true, 'Giseli (barracao1) DEVE ter permissão de ferramentas');
assert.strictEqual(mobileCtx.canUserRequestTools('giseli'), true, 'Giseli alias DEVE ter permissão de ferramentas');
assert.strictEqual(mobileCtx.canUserRequestTools('palotina1'), true, 'Adilson (palotina1) DEVE ter permissão de ferramentas');
assert.strictEqual(mobileCtx.canUserRequestTools('adilson'), true, 'Adilson alias DEVE ter permissão de ferramentas');
assert.strictEqual(mobileCtx.canUserRequestTools('thiago'), true, 'Admin Thiago DEVE ter permissão de ferramentas');
assert.strictEqual(mobileCtx.canUserRequestTools('erick'), true, 'Admin Erick DEVE ter permissão de ferramentas');
assert.strictEqual(mobileCtx.canUserRequestTools('deivid'), true, 'Admin Deivid DEVE ter permissão de ferramentas');
assert.strictEqual(mobileCtx.canUserRequestTools('gabriely'), true, 'Admin Gabriely DEVE ter permissão de ferramentas');

// Bloqueados: Cleverson, Leonardo e SMO
assert.strictEqual(mobileCtx.canUserRequestTools('beltrao2'), false, 'Cleverson (beltrao2) NÃO PODE ter permissão de ferramentas');
assert.strictEqual(mobileCtx.canUserRequestTools('cleverson'), false, 'Cleverson alias NÃO PODE ter permissão de ferramentas');
assert.strictEqual(mobileCtx.canUserRequestTools('pato1'), false, 'Leonardo (pato1) NÃO PODE ter permissão de ferramentas');
assert.strictEqual(mobileCtx.canUserRequestTools('leonardo'), false, 'Leonardo alias NÃO PODE ter permissão de ferramentas');
assert.strictEqual(mobileCtx.canUserRequestTools('smo1'), false, 'Técnicos SMO (smo1) NÃO PODEM ter permissão de ferramentas');
assert.strictEqual(mobileCtx.canUserRequestTools('smo'), false, 'Técnicos SMO alias NÃO PODEM ter permissão de ferramentas');
assert.strictEqual(mobileCtx.canUserRequestTools('terceiros'), false, 'Terceiros SMO NÃO PODEM ter permissão de ferramentas');
console.log('✓ Matriz de permissões canUserRequestTools() validada 100%.');

// 1.2 Visibilidade do Catálogo por Usuário & Ocultação de Lubrificante
console.log('1.2 Visibilidade de Ferramentas, Fibra e Lubrificante de Fio:');
assert.strictEqual(mobileCtx.isItemLubrificanteRestricted('Lubrificante Passa Fio'), true, 'Lubrificante Passa Fio deve ser restrito');
assert.strictEqual(mobileCtx.isItemRestrictedForSolicitantes('Lubrificante Passa Fio'), true, 'Lubrificante de fio deve ser restrito para filiais');

// Testando Iury (PERMITIDO ferramentas, BLOQUEADO fibra e lubrificante)
vm.runInContext('currentUser = "beltrao1";', mobileCtx);
const iuryCatalog = mobileCtx.getCatalogoForUser();
const iuryCats = iuryCatalog.map(c => c.categoria);
assert.ok(iuryCats.includes('EQUIPAMENTOS TÉCNICOS (FERRAMENTAS)'), 'Iury DEVE visualizar a aba de ferramentas');
assert.ok(!iuryCats.includes('FIBRA'), 'Iury não deve visualizar materiais de fibra óptica');
const iuryCabos = iuryCatalog.find(c => c.categoria === 'CABOS E FIOS');
assert.ok(iuryCabos && !iuryCabos.itens.includes('Lubrificante Passa Fio'), 'Iury NÃO DEVE visualizar Lubrificante Passa Fio');
assert.ok(iuryCabos && iuryCabos.itens.includes('Caixa de Cabo de Rede'), 'Iury DEVE visualizar Caixa de Cabo de Rede');

// Testando Admin (visualiza lubrificante e fibra)
vm.runInContext('currentUser = "thiago";', mobileCtx);
const adminCatalog = mobileCtx.getCatalogoForUser();
const adminCabos = adminCatalog.find(c => c.categoria === 'CABOS E FIOS');
assert.ok(adminCabos && adminCabos.itens.includes('Lubrificante Passa Fio'), 'Admin DEVE visualizar Lubrificante Passa Fio no estoque');

// Testando Giseli (PERMITIDO)
vm.runInContext('currentUser = "barracao1";', mobileCtx);
const giseliCatalog = mobileCtx.getCatalogoForUser();
const giseliCats = giseliCatalog.map(c => c.categoria);
assert.ok(giseliCats.includes('EQUIPAMENTOS TÉCNICOS (FERRAMENTAS)'), 'Giseli DEVE visualizar a aba de ferramentas');

// Testando Adilson (PERMITIDO)
vm.runInContext('currentUser = "palotina1";', mobileCtx);
const adilsonCatalog = mobileCtx.getCatalogoForUser();
const adilsonCats = adilsonCatalog.map(c => c.categoria);
assert.ok(adilsonCats.includes('EQUIPAMENTOS TÉCNICOS (FERRAMENTAS)'), 'Adilson DEVE visualizar a aba de ferramentas');

// Testando Cleverson (BLOQUEADO)
vm.runInContext('currentUser = "beltrao2";', mobileCtx);
const cleversonCatalog = mobileCtx.getCatalogoForUser();
const cleversonCats = cleversonCatalog.map(c => c.categoria);
assert.ok(!cleversonCats.includes('EQUIPAMENTOS TÉCNICOS (FERRAMENTAS)'), 'Cleverson NÃO DEVE ver a categoria de ferramentas');
assert.ok(cleversonCats.includes('CÂMERAS'), 'Cleverson DEVE ver câmeras');
assert.ok(cleversonCats.includes('CABOS E FIOS'), 'Cleverson DEVE ver cabos');

// Testando Leonardo (BLOQUEADO)
vm.runInContext('currentUser = "pato1";', mobileCtx);
const leoCatalog = mobileCtx.getCatalogoForUser();
const leoCats = leoCatalog.map(c => c.categoria);
assert.ok(!leoCats.includes('EQUIPAMENTOS TÉCNICOS (FERRAMENTAS)'), 'Leonardo NÃO DEVE ver a categoria de ferramentas');

// Testando SMO (BLOQUEADO)
vm.runInContext('currentUser = "smo1";', mobileCtx);
const smoCatalog = mobileCtx.getCatalogoForUser();
const smoCats = smoCatalog.map(c => c.categoria);
assert.ok(!smoCats.includes('EQUIPAMENTOS TÉCNICOS (FERRAMENTAS)'), 'Técnicos SMO NÃO DEVEM ver a categoria de ferramentas');
console.log('✓ Filtragem de catálogo no mobile validada perfeitamente.');

// 1.3 Bloqueio de Adição ao Carrinho para Cleverson/Leonardo/SMO
console.log('1.3 Bloqueio em tempo real de adição de ferramentas ao carrinho');
vm.runInContext('currentUser = "beltrao2"; mobileCart = {};', mobileCtx); // Cleverson
windowMock.lastToast = null;
vm.runInContext('incrementMobileCart("Alicate de Corte");', mobileCtx);
assert.strictEqual(vm.runInContext('mobileCart["Alicate de Corte"];', mobileCtx), undefined, 'Cleverson não pode adicionar ferramenta ao carrinho');
assert.ok(windowMock.lastToast && windowMock.lastToast.msg.includes('restrita exclusivamente a Iury, Giseli e Adilson'), 'Toast explicativo deve ser acionado');

// Permite suprimento normal para Cleverson
vm.runInContext('incrementMobileCart("Câmera Bullet UNV");', mobileCtx);
assert.strictEqual(vm.runInContext('mobileCart["Câmera Bullet UNV"];', mobileCtx), 1, 'Cleverson pode solicitar suprimentos normais normalmente');
console.log('✓ Cleverson bloqueado para ferramentas, liberado para suprimentos.');

// 1.4 Testando Iury com Justificativa
console.log('1.4 Iury solicitando ferramentas com justificativa');
vm.runInContext('currentUser = "beltrao1";', mobileCtx);
vm.runInContext('mobileCart = {}; mobileCartJustifications = {};', mobileCtx);

// Iury adiciona ferramenta sem justificativa -> avanço bloqueado
vm.runInContext('mobileCart["Alicate de Corte"] = 1;', mobileCtx);
getOrCreateElement('checkout-solicitante').value = 'Iury';
getOrCreateElement('checkout-urgencia').value = 'Normal';
getOrCreateElement('checkout-branch-select').value = 'BELTRAO_IURY';
getOrCreateElement('checkout-obs').value = '';

windowMock.lastAlert = null;
vm.runInContext('openConferenciaModal();', mobileCtx);
assert.ok(windowMock.lastAlert && windowMock.lastAlert.includes('JUSTIFICATIVA OBRIGATÓRIA PARA FERRAMENTAS'), 'Iury deve ser solicitado a justificar a ferramenta');

// Iury adiciona justificativa válida -> avanço liberado
vm.runInContext('setToolJustification("Alicate de Corte", "O meu estragou, tentamos arrumar mas não deu certo, se possível mandar outro");', mobileCtx);
windowMock.lastAlert = null;
vm.runInContext('openConferenciaModal();', mobileCtx);
assert.strictEqual(windowMock.lastAlert, null, 'Iury com justificativa deve poder avançar');
console.log('✓ Iury avançou com justificativa preenchida.');

// 1.5 Limpeza automática do carrinho se usuário não autorizado logar com ferramentas residuais
console.log('1.5 Sanitização automática de carrinho em caso de troca de usuário');
vm.runInContext('mobileCart["Multímetro"] = 1; mobileCart["Câmera UNV"] = 2;', mobileCtx);
vm.runInContext('currentUser = "cleverson";', mobileCtx);
vm.runInContext('setupUserInterface();', mobileCtx);
assert.strictEqual(vm.runInContext('mobileCart["Multímetro"];', mobileCtx), undefined, 'Multímetro deve ter sido expurgado do carrinho de Cleverson');
assert.strictEqual(vm.runInContext('mobileCart["Câmera UNV"];', mobileCtx), 2, 'Câmera UNV deve ter permanecido no carrinho');
console.log('✓ Expurgo automático de ferramentas residuais no carrinho funcionando.');


// ====================================================
// 2. TESTES EM index.html (Matriz Desktop)
// ====================================================
console.log('\n--- Testando index.html (Matriz Desktop) ---');
const desktopCode = extractScript(path.join(__dirname, '..', 'index.html'));
const desktopCtx = createSandbox(desktopCode);

// 2.1 canUserRequestTools em index.html
console.log('2.1 canUserRequestTools() em index.html:');
assert.strictEqual(desktopCtx.canUserRequestTools('beltrao1'), true);
assert.strictEqual(desktopCtx.canUserRequestTools('iury'), true);
assert.strictEqual(desktopCtx.canUserRequestTools('barracao1'), true);
assert.strictEqual(desktopCtx.canUserRequestTools('palotina1'), true);
assert.strictEqual(desktopCtx.canUserRequestTools('thiago'), true);
assert.strictEqual(desktopCtx.canUserRequestTools('deivid'), true);
assert.strictEqual(desktopCtx.canUserRequestTools('gabriely'), true);

assert.strictEqual(desktopCtx.canUserRequestTools('beltrao2'), false);
assert.strictEqual(desktopCtx.canUserRequestTools('cleverson'), false);
assert.strictEqual(desktopCtx.canUserRequestTools('pato1'), false);
assert.strictEqual(desktopCtx.canUserRequestTools('leonardo'), false);
assert.strictEqual(desktopCtx.canUserRequestTools('smo1'), false);
console.log('✓ canUserRequestTools() no index.html idêntico e consistente.');

// 2.2 Catálogo em index.html
console.log('2.2 Catálogo do index.html para perfis autorizados vs não-autorizados:');
assert.strictEqual(desktopCtx.isItemLubrificanteRestricted('Lubrificante Passa Fio'), true, 'Lubrificante deve ser restrito no desktop');

vm.runInContext('currentUser = "pato1";', desktopCtx); // Leonardo
const patoCat = desktopCtx.getCatalogoForUser();
assert.ok(!patoCat.some(c => c.categoria === 'EQUIPAMENTOS TÉCNICOS (FERRAMENTAS)'), 'Leonardo não deve ter aba de ferramentas no index.html');
const patoCabos = patoCat.find(c => c.categoria === 'CABOS E FIOS');
assert.ok(patoCabos && !patoCabos.itens.includes('Lubrificante Passa Fio'), 'Leonardo não deve ver Lubrificante Passa Fio no index.html');

vm.runInContext('currentUser = "barracao1";', desktopCtx); // Giseli
const giseliDeskCat = desktopCtx.getCatalogoForUser();
assert.ok(giseliDeskCat.some(c => c.categoria === 'EQUIPAMENTOS TÉCNICOS (FERRAMENTAS)'), 'Giseli deve ter aba de ferramentas no index.html');
const giseliCabos = giseliDeskCat.find(c => c.categoria === 'CABOS E FIOS');
assert.ok(giseliCabos && !giseliCabos.itens.includes('Lubrificante Passa Fio'), 'Giseli não deve ver Lubrificante Passa Fio no index.html');

vm.runInContext('currentUser = "erick";', desktopCtx); // Admin Erick
const erickDeskCat = desktopCtx.getCatalogoForUser();
const erickCabos = erickDeskCat.find(c => c.categoria === 'CABOS E FIOS');
assert.ok(erickCabos && erickCabos.itens.includes('Lubrificante Passa Fio'), 'Admin Erick deve ver Lubrificante Passa Fio no estoque Matriz');

// 2.3 Bloqueio de submissão em submitNewEnvio no index.html
console.log('2.3 Validação de submissão desktop em submitNewEnvio:');
vm.runInContext('currentUser = "smo1";', desktopCtx); // SMO
vm.runInContext(`
  currentCart = {
    'Multímetro': 1,
    'Cabo de Rede': 1
  };
  currentToolJustifications = {};
`, desktopCtx);

getOrCreateElement('req-filial').value = 'Terceiros SMO';
getOrCreateElement('req-solicitante').value = 'Técnico SMO';
getOrCreateElement('req-urgencia').value = 'Normal';
getOrCreateElement('req-obs').value = '';

windowMock.lastAlert = null;
vm.runInContext('submitNewEnvio();', desktopCtx);
assert.ok(windowMock.lastAlert && windowMock.lastAlert.includes('ACESSO RESTRITO A FERRAMENTAS'), 'submitNewEnvio deve bloquear usuário não autorizado que possua ferramenta no carrinho');
console.log('✓ submitNewEnvio bloqueia ferramenta para filial não autorizada.');

// 2.4 Giseli preenchendo justificativa e submetendo
vm.runInContext('currentUser = "barracao1";', desktopCtx); // Giseli
vm.runInContext(`
  currentCart = {
    'Multímetro': 1,
    'Cabo de Rede': 1
  };
  currentToolJustifications = {
    'Multímetro': 'O anterior queimou durante aferição no cliente'
  };
`, desktopCtx);
getOrCreateElement('req-filial').value = 'Barracão (Giseli)';
getOrCreateElement('req-solicitante').value = 'Giseli';

windowMock.lastAlert = null;
vm.runInContext('submitNewEnvio();', desktopCtx);
assert.strictEqual(windowMock.lastAlert, null, 'Giseli com justificativa válida deve passar direto para gravação');
console.log('✓ Giseli registra ferramenta normalmente com justificativa.');

console.log('\n🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!\n');
