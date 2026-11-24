// Teste de ponta a ponta no navegador. Uso (puppeteer-core precisa estar instalado fora do projeto):
//   node e2e/flow.cjs A|B|C  <caminho-do-chrome> <pasta-do-puppeteer-core>
// Fases: A = cadastro de acesso; B = login + dados da empresa; C = produtos (depois da aprovação no banco).
const [phase, chromePath, puppeteerDir, imagePath] = process.argv.slice(2);
const puppeteer = require(puppeteerDir);

const BASE = 'http://localhost:8100';
// Credenciais de teste vêm do ambiente (E2E_COMPANY_*), nunca escritas aqui.
const EMAIL = process.env.E2E_COMPANY_EMAIL;
const PASSWORD = process.env.E2E_COMPANY_PASSWORD;
if (!EMAIL || !PASSWORD) throw new Error('Defina E2E_COMPANY_EMAIL e E2E_COMPANY_PASSWORD antes de rodar o teste.');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...args) => console.log(...args);

async function setValue(page, selector, value) {
  await page.$eval(
    selector,
    (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    value,
  );
}

async function clickButton(page, text) {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a')].find((x) => x.innerText.trim() === t);
    if (el) el.click();
    return Boolean(el);
  }, text);
  if (!ok) throw new Error(`botão "${text}" não encontrado`);
}

const bodyText = (page) => page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
const path = (page) => new URL(page.url()).pathname;

async function login(page) {
  await page.goto(`${BASE}/entrar`, { waitUntil: 'networkidle2' });
  await page.type('#email', EMAIL);
  await page.type('#password', PASSWORD);
  await clickButton(page, 'Entrar');
  await sleep(2500);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox'],
    userDataDir: `ud-e2e-${Date.now()}`,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900 });
  page.on('pageerror', (e) => log('PAGEERR', e.message.slice(0, 200)));
  page.on('dialog', async (d) => d.dismiss());

  if (phase === 'A') {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
    log('1) sem sessão vai para:', path(page));
    await page.goto(`${BASE}/produtos`, { waitUntil: 'networkidle2' });
    log('2) /produtos sem sessão vai para:', path(page));
    await page.goto(`${BASE}/cadastro`, { waitUntil: 'networkidle2' });
    await clickButton(page, 'Criar acesso');
    log('3) cadastro vazio:', (await bodyText(page)).includes('Informe o nome do responsável.'));
    await page.type('#name', 'Dona do Mercado Teste');
    await page.type('#email', EMAIL);
    await page.type('#password', PASSWORD);
    await page.type('#confirm', PASSWORD);
    await clickButton(page, 'Criar acesso');
    await sleep(3500);
    log('4) após enviar:', (await bodyText(page)).slice(0, 160));
  }

  if (phase === 'B') {
    await login(page);
    log('1) após login vai para:', path(page));
    await clickButton(page, 'Enviar cadastro');
    log('2) formulário vazio mostra erros:', (await bodyText(page)).includes('Revise os campos destacados.'));
    await page.type('#legalName', 'Mercado Teste Comercio LTDA');
    await page.type('#tradeName', 'Mercado Teste');
    await page.type('#cnpj', '11111111111111');
    await page.type('#phone', '45999998888');
    await page.select('#category', 'Mercado');
    await page.type('#cep', '85801000');
    await sleep(2500);
    await page.type('#number', '100');
    await clickButton(page, 'Enviar cadastro');
    await sleep(800);
    log('3) CNPJ inválido:', (await bodyText(page)).includes('Digite um CNPJ válido.'));
    await setValue(page, '#cnpj', '');
    await page.type('#cnpj', '11222333000181');
    await clickButton(page, 'Enviar cadastro');
    await sleep(3000);
    log('4) após enviar vai para:', path(page), '|', (await bodyText(page)).slice(0, 140));
    await page.goto(`${BASE}/produtos`, { waitUntil: 'networkidle2' });
    log('5) pendente tentando /produtos vai para:', path(page));
  }

  if (phase === 'C') {
    await login(page);
    log('1) empresa aprovada vai para:', path(page));
    log('2) lista vazia:', (await bodyText(page)).includes('Você ainda não cadastrou produtos'));
    await clickButton(page, 'Cadastrar primeiro produto');
    await sleep(800);
    await clickButton(page, 'Publicar produto');
    log('3) form vazio mostra erros:', (await bodyText(page)).includes('Revise os campos destacados.'));
    await page.type('#name', 'Iogurte natural 170g');
    const categoryValue = await page.$eval('#categoryId option:nth-child(6)', (o) => o.value);
    await page.select('#categoryId', categoryValue);
    await page.type('#description', 'Lote com validade próxima.');
    await page.type('#originalPrice', '10,99');
    await page.type('#discountPercent', '10');
    await clickButton(page, 'Publicar produto');
    await sleep(500);
    log('4) desconto 10 recusado:', (await bodyText(page)).includes('entre 20% e 90%'));
    await setValue(page, '#discountPercent', '');
    await page.type('#discountPercent', '30');
    log('5) preço final mostrado:', (await bodyText(page)).includes('R$ 7,69'));
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    await setValue(page, '#expiresOn', future);
    await page.type('#quantity', '12');
    const fileInput = await page.$('input[type=file]');
    await fileInput.uploadFile(imagePath);
    await sleep(500);
    await clickButton(page, 'Publicar produto');
    await sleep(4000);
    log('6) após publicar vai para:', path(page));
    log('7) lista mostra produto:', (await bodyText(page)).slice(0, 260));
    log('8) tem foto:', await page.evaluate(() => Boolean(document.querySelector('img.product-thumb'))));
    await clickButton(page, 'Editar');
    await sleep(1500);
    await setValue(page, '#quantity', '');
    await page.type('#quantity', '0');
    await clickButton(page, 'Salvar alterações');
    await sleep(3000);
    log('9) após editar (esgotado):', (await bodyText(page)).includes('Esgotado'));
  }

  if (phase === 'D') {
    await login(page);
    await clickButton(page, 'Remover');
    await sleep(500);
    log('1) pede confirmação:', (await bodyText(page)).includes('Remover produto?'));
    await page.evaluate(() => {
      const dialog = document.querySelector('.dialog');
      [...dialog.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Remover').click();
    });
    await sleep(2500);
    log('2) lista após remover:', (await bodyText(page)).includes('Você ainda não cadastrou produtos'));
  }

  await browser.close();
})().catch((e) => {
  console.log('ERRO', e.message);
  process.exit(1);
});
