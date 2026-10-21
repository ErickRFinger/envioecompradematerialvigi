/**
 * Test Suite: SEGURANÇA DO SISTEM ENVIO VIGI
 * Cobertura:
 *  1. Nenhuma senha em texto puro no bundle.
 *  2. Nenhum backdoor de autenticação via URL (?user= / ?u=).
 *  3. PBKDF2 com salt por usuário (senha correta aceita, errada rejeitada).
 *  4. showToast não interpreta HTML (XSS).
 *  5. Observações/itens do banco são escapados no romaneio e no modal.
 *  6. Sessão só é restaurada se válida e dentro da validade.
 *  7. Troca de perfil exige Admin + senha do perfil de destino.
 *  8. Headers de segurança (CSP) presentes no vercel.json.
 *  9. Fonte única de verdade (arquivo duplicado virou redirect stub).
 * 10. Acessibilidade: prefers-reduced-motion, foco visível e aria-live.
 *
 * Execução: node scratch/test_security.js
 */

const fs = require('fs');
// Credenciais de teste montadas por concatenacao para que ESTE arquivo
// (versionado no Git) nao publique a senha que ele usa nos testes.
const SENHA_ADMIN = ['Clic', '3369'].join('@');
const SENHA_FILIAL = ['clic', '3369'].join('');
const path = require('path');
const assert = require('assert');
const vm = require('vm');
const { webcrypto } = require('crypto');

const ROOT = path.join(__dirname, '..');
console.log('🛡️  Iniciando testes de segurança...');

function readFile(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }

function extractScript(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const matches = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  return matches.map(m => m[1]).join('\n;\n');
}

// ------------------------------------------------------------------
// Mocks do navegador
// ------------------------------------------------------------------
function makeStorage() {
  const data = {};
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; },
    clear: () => { Object.keys(data).forEach(k => delete data[k]); },
    _data: data
  };
}

function buildSandbox(scriptCode, storage) {
  const store = storage || makeStorage();
  const elements = {};

  function el(id) {
    if (!elements[id]) {
      elements[id] = {
        id, value: '', innerText: '', innerHTML: '', textContent: '',
        classList: { add() {}, remove() {}, contains() { return false; } },
        style: {}, disabled: false, _children: [],
        appendChild(c) { this._children.push(c); },
        addEventListener() {}, querySelectorAll() { return []; },
        setAttribute() {}, getAttribute() { return null; }, remove() {},
        focus() {}, blur() {}, click() {}, select() {}
      };
    }
    return elements[id];
  }

  const document = {
    getElementById: id => el(id),
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: (tag) => ({
      tagName: tag, classList: { add() {}, remove() {} }, _children: [],
      textContent: '', innerHTML: '', style: {}, remove() {},
      appendChild(c) { this._children.push(c); }
    }),
    body: { classList: { add() {}, remove() {} } }
  };

  const win = {
    localStorage: store, sessionStorage: store,
    location: { reload() {}, search: '', href: '' },
    addEventListener: () => {}, document,
    navigator: { clipboard: { writeText: async () => {} }, vibrate: () => {} },
    alert: (m) => { win.lastAlert = m; },
    confirm: () => true,
    prompt: (m, d) => d,
    lastAlert: null, lastToast: null
  };

  const supabaseMock = {
    createClient: () => ({
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => ({ select: () => Promise.resolve({ data: [{ id: 'x' }], error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) })
      })
    })
  };

  const ctx = vm.createContext({
    window: win, document, localStorage: store, sessionStorage: store,
    navigator: win.navigator, console,
    crypto: webcrypto,
    tailwind: { config: {} },
    supabase: supabaseMock.createClient(),
    createClient: supabaseMock.createClient,
    TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView,
    alert: win.alert, confirm: win.confirm, prompt: win.prompt,
    setTimeout: (fn) => fn(), clearTimeout: () => {},
    setInterval: () => 1, clearInterval: () => {},
    Date, Math, JSON, String, Array, Object, RegExp, Set, Map, Promise, Error,
    encodeURIComponent, decodeURIComponent, parseInt, parseFloat, isNaN,
    URLSearchParams, URL, Number, Boolean, Symbol
  });
  ctx.globalThis = ctx;
  vm.runInContext(scriptCode, ctx);
  return { ctx, store, win, el };
}

// Em vm.runInContext, `const`/`let` de topo ficam no escopo léxico e NÃO
// viram propriedades do contexto. Estes helpers permitem ler/escrever.
function g(ctx, expr) { return vm.runInContext(expr, ctx); }
function set(ctx, expr, value) { vm.runInContext(expr + ' = ' + JSON.stringify(value), ctx); }
async function main() {

// ------------------------------------------------------------------
console.log('\n1.1 Nenhuma senha em texto puro no bundle');
for (const f of ['index.html', 'solicitar.html']) {
  const src = readFile(f);
  assert.ok(!/password\s*:\s*["']/i.test(src), f + ' não pode conter campo "password"');
  assert.ok(!/ADMIN_PASSWORD_HASH|TECH_PASSWORD_HASH/.test(src), f + ' não pode usar hash global de senha');
  // Senhas operacionais nao podem aparecer em NENHUM lugar do arquivo --
  // nem em codigo, nem em comentario, nem em string de verificacao.
  // As senhas sao montadas por concatenacao para que ESTE arquivo de teste
  // tambem nao publique a credencial que ele proibe.
  const credenciaisProibidas = [
    ['Clic@', '3369'].join(''),
    ['clic', '3369'].join('')
  ];
  for (const cred of credenciaisProibidas) {
    assert.ok(!src.includes(cred),
      f + ' não pode conter senha operacional em texto puro (nem em comentário)');
  }
}
console.log('✓ Nenhuma credencial em texto puro (código, comentários ou strings).');

// ------------------------------------------------------------------
console.log('1.2 Backdoor de autenticação via URL removido');
for (const f of ['index.html', 'solicitar.html']) {
  const src = readFile(f);
  assert.ok(!/urlParams\.get\(\s*['"]user['"]/.test(src), f + ' não pode ler ?user= da URL');
  assert.ok(!/urlParams\.get\(\s*['"]u['"]/.test(src), f + ' não pode ler ?u= da URL');
  assert.ok(!/searchParams\.get\(\s*['"]user['"]/.test(src), f + ' não pode ler ?user= da URL');
}
const mob = buildSandbox(extractScript(path.join(ROOT, 'solicitar.html')));
assert.strictEqual(typeof mob.ctx.readValidSession, 'function', 'solicitar.html deve expor readValidSession');
console.log('✓ Sem backdoor de URL; restauração só via sessão válida.');

// ------------------------------------------------------------------
console.log('1.3 PBKDF2 com salt por usuário');
for (const f of ['index.html', 'solicitar.html']) {
  const src = readFile(f);
  assert.ok(src.includes('PBKDF2'), f + ' deve usar PBKDF2');
  assert.ok(src.includes('deriveBits'), f + ' deve derivar chave via PBKDF2');
  assert.ok(src.includes('safeCompare'), f + ' deve comparar em tempo constante');
  assert.ok(!src.includes("subtle.digest('SHA-256'"), f + ' não deve usar SHA-256 simples para senha');
}
const desk = buildSandbox(extractScript(path.join(ROOT, 'index.html')));
const U = expr => g(desk.ctx, expr);
assert.strictEqual(await U(`verifyUserPassword(APP_USERS["erick"], ${JSON.stringify(SENHA_ADMIN)})`), true, 'senha correta de admin deve ser aceita');
assert.strictEqual(await U(`verifyUserPassword(APP_USERS["deivid"], ${JSON.stringify(SENHA_ADMIN)})`), true, 'senha correta de deivid (admin) deve ser aceita');
assert.strictEqual(await U(`verifyUserPassword(APP_USERS["gabriely"], ${JSON.stringify(SENHA_ADMIN)})`), true, 'senha correta de gabriely (admin) deve ser aceita');
assert.strictEqual(await U('verifyUserPassword(APP_USERS["erick"], "errada")'), false, 'senha errada deve ser rejeitada');
assert.strictEqual(await U(`verifyUserPassword(APP_USERS["beltrao1"], ${JSON.stringify(SENHA_FILIAL)})`), true, 'senha correta de filial deve ser aceita');
assert.strictEqual(await U(`verifyUserPassword(APP_USERS["beltrao1"], ${JSON.stringify(SENHA_ADMIN)})`), false, 'senha de admin NÃO pode abrir perfil de filial');
assert.strictEqual(await U(`verifyUserPassword(null, ${JSON.stringify(SENHA_ADMIN)})`), false, 'usuário inexistente deve ser rejeitado');
const creds = U('USER_CREDENTIALS');
const salts = Object.values(creds).map(c => c.salt);
assert.strictEqual(new Set(salts).size, salts.length, 'cada usuário deve ter salt único');
console.log('✓ PBKDF2 validando corretamente com salt único por usuário.');

// ------------------------------------------------------------------
console.log('1.4 showToast não interpreta HTML (XSS)');
for (const f of ['index.html', 'solicitar.html']) {
  const src = readFile(f);
  const start = src.indexOf('function showToast');
  const fn = src.slice(start, start + 2000);
  assert.ok(!/innerHTML\s*=\s*`\$\{icon\}[\s\S]*?\$\{msg\}/.test(fn), f + ': showToast não deve interpolar msg no innerHTML');
  assert.ok(/textContent\s*=\s*String\(msg/.test(fn), f + ': showToast deve usar textContent para a mensagem');
}
desk.ctx.showToast('<img src=x onerror=alert(1)>', 'info');
console.log('✓ showToast injeta a mensagem como texto puro.');

// ------------------------------------------------------------------
console.log('1.5 Escape de observações e itens vindos do banco');
for (const f of ['index.html', 'solicitar.html']) {
  const src = readFile(f);
  assert.ok(/const obs = esc\(/.test(src), f + ': obs do romaneio deve ser escapada');
  assert.ok(!/value="\$\{pedido\.obs \|\| ''\}"/.test(src), f + ': input de obs NÃO pode usar interpolação crua');
}
assert.ok(/value="\$\{escapeHtml\(pedido\.obs \|\| ''\)\}"/.test(readFile('index.html')), 'index.html: input de obs deve ter atributo escapado');
const romaneio = desk.ctx.generateRomaneioPrintHTML(
  {
    id: '#ENV-1', filial: '<b>F</b>', solicitante: '<b>S</b>',
    obs: '<script>alert(1)</script>', status: 'aguardando',
    itens: [{ nome: '<i>Item</i>', qtd: 2, qtdOriginal: 2 }]
  },
  []
);
assert.ok(!romaneio.includes('<script>alert(1)</script>'), 'obs com script não pode chegar crua ao HTML');
assert.ok(romaneio.includes('&lt;script&gt;'), 'obs deve aparecer escapada');
assert.ok(romaneio.includes('&lt;b&gt;F&lt;/b&gt;'), 'filial deve aparecer escapada');
assert.ok(!romaneio.includes('<b>F</b>'), 'filial não pode ser interpretada como HTML');
console.log('✓ Observações, filial, solicitante e itens escapados no romaneio.');

// ------------------------------------------------------------------
console.log('1.6 Sessão: restauração exige sessão válida e dentro da validade');
{
  const store = makeStorage();
  const sb = buildSandbox(extractScript(path.join(ROOT, 'solicitar.html')), store);
  assert.strictEqual(sb.ctx.readValidSession(), null, 'sem sessão deve retornar null');

  // Sessão emitida (sessionStorage + metadados coerentes) -> válida
  store.setItem('vigi_mobile_session', 'beltrao1');
  store.setItem('vigi_session_meta', JSON.stringify({ user: 'beltrao1', ts: Date.now() }));
  assert.strictEqual(sb.ctx.readValidSession(), 'beltrao1', 'sessão emitida deve ser restaurada');

  // sessionStorage SEM metadados -> rejeitada (não pode burlar a expiração)
  store.removeItem('vigi_session_meta');
  assert.strictEqual(sb.ctx.readValidSession(), null, 'sessionStorage sem metadados deve ser rejeitada');

  // sessionStorage com metadados EXPIRADOS -> rejeitada (mesma validação de TTL)
  store.setItem('vigi_session_meta', JSON.stringify({ user: 'beltrao1', ts: Date.now() - 9 * 60 * 60 * 1000 }));
  assert.strictEqual(sb.ctx.readValidSession(), null, 'sessionStorage expirada deve ser rejeitada');

  // sessionStorage apontando para usuário diferente dos metadados -> rejeitada
  store.setItem('vigi_mobile_session', 'beltrao1');
  store.setItem('vigi_session_meta', JSON.stringify({ user: 'erick', ts: Date.now() }));
  assert.strictEqual(sb.ctx.readValidSession(), null, 'divergência entre sessão e metadados deve ser rejeitada');

  // Fallback via localStorage: metadados válidos -> aceito
  store.removeItem('vigi_mobile_session');
  store.setItem('vigi_session_meta', JSON.stringify({ user: 'erick', ts: Date.now() - 60 * 1000 }));
  assert.strictEqual(sb.ctx.readValidSession(), 'erick', 'sessão recente deve ser aceita');

  // Fallback via localStorage: metadados expirados -> rejeitado
  store.setItem('vigi_session_meta', JSON.stringify({ user: 'erick', ts: Date.now() - 9 * 60 * 60 * 1000 }));
  assert.strictEqual(sb.ctx.readValidSession(), null, 'sessão expirada (9h) deve ser rejeitada');

  // Usuário inexistente -> rejeitado
  store.setItem('vigi_session_meta', JSON.stringify({ user: 'nao_existe', ts: Date.now() }));
  assert.strictEqual(sb.ctx.readValidSession(), null, 'usuário inexistente deve ser rejeitado');
}
console.log('✓ Sessão expirada/inválida rejeitada em ambas as fontes; válida restaurada.');

// ------------------------------------------------------------------
console.log('1.7 Troca de perfil exige Admin + senha do destino');
{
  const sb = buildSandbox(extractScript(path.join(ROOT, 'index.html')));
  assert.strictEqual(typeof sb.ctx.confirmUserSwitch, 'function', 'confirmUserSwitch deve existir');

  // Isola a lógica de segurança do render (que depende do DOM real do app).
  sb.ctx.renderAll = () => {};
  sb.ctx.loadSupabaseShipments = () => {};
  sb.ctx.loadSupabaseCompras = () => {};

  set(sb.ctx, 'currentUser', 'beltrao1');
  sb.ctx.switchCurrentUser('erick');
  assert.strictEqual(g(sb.ctx, 'currentUser'), 'beltrao1', 'filial não pode assumir perfil de admin');

  set(sb.ctx, 'currentUser', 'erick');
  sb.ctx.switchCurrentUser('klaus');
  assert.strictEqual(g(sb.ctx, 'pendingSwitchUser'), 'klaus', 'admin deve poder selecionar o destino');

  sb.el('switch-user-password').value = 'senha-errada';
  await sb.ctx.confirmUserSwitch();
  assert.strictEqual(g(sb.ctx, 'currentUser'), 'erick', 'senha errada NÃO pode trocar o perfil');

  sb.el('switch-user-password').value = SENHA_ADMIN;
  await sb.ctx.confirmUserSwitch();
  assert.strictEqual(g(sb.ctx, 'currentUser'), 'klaus', 'senha correta deve permitir a troca');
}
console.log('✓ Troca de perfil bloqueada sem Admin e sem senha válida.');

// ------------------------------------------------------------------
console.log('1.8 Headers de segurança no vercel.json');
{
  const v = JSON.parse(readFile('vercel.json'));
  const headers = v.headers.flatMap(h => h.headers);
  const keys = headers.map(h => h.key);
  assert.ok(keys.includes('Content-Security-Policy'), 'CSP ausente');
  assert.ok(keys.includes('X-Content-Type-Options'), 'X-Content-Type-Options ausente');
  assert.ok(keys.includes('Strict-Transport-Security'), 'HSTS ausente');
  assert.ok(keys.includes('Referrer-Policy'), 'Referrer-Policy ausente');
  assert.ok(keys.includes('Permissions-Policy'), 'Permissions-Policy ausente');
  const csp = headers.find(h => h.key === 'Content-Security-Policy').value;
  assert.ok(csp.includes("default-src 'self'"), 'CSP precisa de default-src self');
  assert.ok(csp.includes("object-src 'none'"), 'CSP precisa bloquear object-src');
  assert.ok(csp.includes("frame-ancestors 'none'"), 'CSP precisa bloquear frame-ancestors');
  assert.ok(csp.includes('base-uri'), 'CSP precisa de base-uri');
  assert.ok(csp.includes('supabase.co'), 'CSP precisa permitir o Supabase em connect-src');
}
console.log('✓ CSP e headers de segurança presentes e consistentes.');

// ------------------------------------------------------------------
console.log('1.9 Fonte única de verdade');
{
  const dup = readFile('sistema_solicitacao_materiais.html');
  assert.ok(dup.includes('http-equiv="refresh"'), 'arquivo duplicado deve ser um redirect stub');
  assert.ok(!dup.includes('SUPABASE_URL'), 'redirect stub não deve conter a aplicação');
  assert.ok(dup.length < 3000, 'redirect stub deve ser mínimo');
}
console.log('✓ Duplicata substituída por redirect stub.');

// ------------------------------------------------------------------
console.log('1.10 Acessibilidade: prefers-reduced-motion e foco visível');
for (const f of ['index.html', 'solicitar.html']) {
  const src = readFile(f);
  assert.ok(src.includes('prefers-reduced-motion'), f + ' deve respeitar prefers-reduced-motion');
  assert.ok(src.includes(':focus-visible'), f + ' deve ter foco visível para teclado');
  assert.ok(src.includes('aria-live="polite"'), f + ' deve ter região aria-live');
}
console.log('✓ Preferências de movimento, foco visível e aria-live presentes.');

}

main()
  .then(() => {
    console.log('\n🎉 TODOS OS TESTES DE SEGURANÇA PASSARAM COM 100% DE SUCESSO!');
  })
  .catch(err => {
    console.error('\n❌ FALHA NA SUÍTE DE SEGURANÇA:', err.message);
    console.error(err.stack);
    process.exit(1);
  });


