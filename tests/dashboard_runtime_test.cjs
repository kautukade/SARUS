'use strict';
// Executes the shipped HTML/JavaScript against real Jubi HTTP and SQLite.
// jsdom does not verify layout, CSP enforcement, speech, or Windows integration.
const assert = require('node:assert/strict');
const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const base = process.env.JUBI_TEST_URL;
const pages = readdirSync(join(__dirname, '../sarus/web')).filter(f => f.endsWith('.html'));
const openPages = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) {
  const deadline = Date.now() + 15000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Timed out: ' + label);
    await pause(25);
  }
}
async function loadPage(name) {
  const errors = [], requests = [];
  let pending = 0;
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', e => errors.push(e.message));
  virtualConsole.on('error', e => errors.push(String(e)));
  const dom = await JSDOM.fromURL(base + '/' + name, {
    resources: 'usable', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole,
    beforeParse(w) {
      w.fetch = async (url, options) => {
        pending++;
        requests.push({ url: String(url), options });
        try { return await fetch(new URL(url, base), options); }
        finally { pending--; }
      };
      w.confirm = () => true;
    },
  });
  openPages.push(dom);
  await until(() => dom.window.document.readyState === 'complete', name + ' load');
  await until(() => pending === 0, name + ' requests');
  await pause(100);
  await until(() => pending === 0, name + ' initialization');
  assert.deepEqual(errors, [], name + ' JavaScript errors');
  const d = dom.window.document;
  assert(!d.body.textContent.includes('Page initialization failed'), name + ' init');
  const links = [...d.querySelectorAll('.nav-link')].map(a => a.getAttribute('href'));
  assert.equal(links.length, 18, name + ' navigation count');
  assert.equal(new Set(links).size, 18, name + ' duplicate navigation');
  console.log('PASS page initialization: ' + name);
  return { dom, d, w: dom.window, requests, errors };
}
async function main() {
  const loaded = {};
  for (const name of pages) loaded[name] = await loadPage(name);

  const chat = loaded['chat.html'];
  chat.d.getElementById('chat-input').value = 'DOM project is Lotus';
  chat.d.getElementById('chat-send').click();
  assert.equal(chat.d.getElementById('chat-send').disabled, true);
  chat.d.getElementById('chat-input').value = 'Do not submit duplicate';
  chat.d.getElementById('chat-input').dispatchEvent(new chat.w.KeyboardEvent('keydown', { key: 'Enter' }));
  await until(() => !chat.d.getElementById('chat-send').disabled, 'first reply');
  assert.equal(chat.requests.filter(r => r.url === '/api/chat').length, 1);
  assert.equal(chat.d.querySelectorAll('.message.assistant').length, 1);
  chat.d.getElementById('chat-input').value = 'What is the project name?';
  chat.d.getElementById('chat-send').click();
  await until(() => !chat.d.getElementById('chat-send').disabled, 'follow-up reply');
  assert.equal(chat.d.querySelectorAll('.message.assistant').length, 2);
  const reopened = await loadPage('chat.html');
  assert.equal(reopened.d.querySelectorAll('.message.assistant').length, 2);
  assert(reopened.d.getElementById('chat-messages').textContent.includes('Lotus'));
  reopened.d.getElementById('chat-clear').click();
  assert.equal(reopened.d.querySelectorAll('.message.assistant').length, 0);
  console.log('PASS chat follow-up, duplicate prevention, persisted reload, new conversation');

  const memory = loaded['knowledge.html'];
  // Simulate exactly one pre-execution rejection after a server restart.
  const realFetch = memory.w.fetch;
  let expired = false;
  memory.w.fetch = async (url, options) => {
    if (url === '/api/memory' && options?.method === 'POST' && !expired) {
      expired = true;
      return new Response(JSON.stringify({ error: 'Session expired', code: 'session_expired' }), { status: 403 });
    }
    return realFetch(url, options);
  };
  memory.d.getElementById('memory-title').value = 'DOM note';
  memory.d.getElementById('memory-content').value = 'A persistent dashboard note';
  memory.d.getElementById('memory-save').click();
  await until(() => !memory.d.getElementById('memory-save').disabled, 'save memory');
  assert(expired);
  const notes = await (await fetch(base + '/api/memory?q=persistent')).json();
  assert.equal(notes.filter(n => n.title === 'DOM note').length, 1);
  console.log('PASS memory write with session recovery without duplicate mutation');

  const automation = loaded['automation.html'];
  automation.d.getElementById('automation-name').value = 'DOM automation';
  automation.d.getElementById('automation-prompt').value = 'Describe this local project';
  automation.d.getElementById('automation-create').click();
  await until(() => !automation.d.getElementById('automation-create').disabled, 'create automation');
  assert(automation.d.getElementById('automation-list').textContent.includes('DOM automation'));
  automation.d.querySelector('#automation-list button').click();
  await until(() => automation.d.getElementById('automation-list').textContent.includes('Paused'), 'pause automation');
  console.log('PASS create and pause persistent automation');

  const computer = loaded['computer.html'];
  computer.d.getElementById('file-path').value = 'workspace/dom-file.txt';
  computer.d.getElementById('file-content').value = 'DOM real disk content';
  computer.d.getElementById('file-write').click();
  await until(() => computer.d.getElementById('file-output').textContent.includes('"ok": true'), 'write file');
  computer.d.getElementById('file-output').textContent = '';
  computer.d.getElementById('file-read').click();
  await until(() => computer.d.getElementById('file-output').textContent.includes('DOM real disk content'), 'read file');
  computer.d.getElementById('operator-source').value = 'workspace/dom-file.txt';
  computer.d.getElementById('operator-delete').click();
  await until(() => !computer.d.getElementById('operator-approval-panel').hidden, 'request approval');
  const pending = JSON.parse(computer.d.getElementById('operator-approval-request').textContent);
  assert.equal(pending.action_id, 'workspace.file.delete');
  assert(pending.request_id);
  console.log('PASS workspace file write/read and request-bound approval display');

  assert(loaded['health.html'].d.querySelectorAll('#doctor-grid .card').length > 0);
  console.log('PASS health checks render actual server check results');

  const vision = loaded['vision.html'];
  const input = vision.d.getElementById('vision-file');
  Object.defineProperty(input, 'files', { configurable: true, value: [new vision.w.File(['image'], 'test.png', { type: 'image/png' })] });
  input.dispatchEvent(new vision.w.Event('change'));
  await until(() => vision.d.getElementById('vision-preview').hasAttribute('src'), 'preview image');
  Object.defineProperty(input, 'files', { configurable: true, value: [new vision.w.File(['bad'], 'test.txt', { type: 'text/plain' })] });
  input.dispatchEvent(new vision.w.Event('change'));
  assert(!vision.d.getElementById('vision-preview').hasAttribute('src'));
  vision.d.getElementById('vision-analyze').click();
  await pause(50);
  assert(!vision.requests.some(r => r.url === '/api/vision/analyze'));
  console.log('PASS invalid image clears stale image and prevents unintended analysis');
  for (const page of [...Object.values(loaded), reopened]) assert.deepEqual(page.errors, []);
  console.log('PASS all 18 dashboard pages and 7 DOM interaction flows (controlled inference fixture).');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => {
  for (const dom of openPages) dom.window.close();
});
