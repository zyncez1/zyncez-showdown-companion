'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
test('clicking the toolbar extension opens the OpenRouter settings popup',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  assert.equal(m.action.default_popup,'popup.html');
  const html=fs.readFileSync(path.join(root,'popup.html'),'utf8');
  assert.match(html,/<input[^>]+id="key"[^>]+type="password"/);
  assert.match(html,/Save settings & personality/);
  assert.match(html,/id="personality-notes"/);
  assert.match(html,/id="reply-style"/);
  assert.match(html,/src\/popup\.js/);
});
test('messenger re-reads settings after toolbar changes, without initiating AI in popup',()=>{
  const content=fs.readFileSync(path.join(root,'src/content.js'),'utf8');
  const popup=fs.readFileSync(path.join(root,'src/popup.js'),'utf8');
  assert.match(content,/await loadSettings\(\)/);
  assert.doesNotMatch(popup,/ZYNCEZ_ASK/);
});

test('length picker is visible in messenger and available in both settings screens',()=>{
  const html=fs.readFileSync(path.join(root,'popup.html'),'utf8');
  const content=fs.readFileSync(path.join(root,'src/content.js'),'utf8');
  for (const v of ['short','medium','long']) {
    assert.match(html,new RegExp(`value="${v}"`));
    assert.match(content,new RegExp(`value="${v}"`));
  }
  assert.match(content,/data-quick-length/);
  assert.match(content,/ZYNCEZ_SET_REPLY_STYLE/);
  assert.match(content,/quickLength\.addEventListener\('change'/);
  assert.match(content,/quickLength\.value=data\.replyStyle/);
});
