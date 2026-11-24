'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const script=fs.readFileSync(path.join(root,'src/content.js'),'utf8');
const css=fs.readFileSync(path.join(root,'src/chat-ui.js'),'utf8');
const popup=fs.readFileSync(path.join(root,'src/popup.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const models=require('../src/model-catalog.js');

test('in-game picker uses a built-in model list and never fetches the OpenRouter catalog',()=>{
  assert.equal(models.PRESET_MODELS.length>=5,true);
  assert.ok(models.PRESET_MODELS.some(m=>m.id==='openai/gpt-5-mini'));
  assert.ok(models.PRESET_MODELS.some(m=>m.id==='anthropic/claude-opus-5.5'));
  assert.ok(models.offlineOptions('custom/my-model')[0].id==='custom/my-model');
  assert.match(script,/offlineOptions\(currentModel,recentIds\)/);
  assert.match(script,/data-model-trigger/);
  assert.match(script,/class="composer"/);
  assert.doesNotMatch(script,/ZYNCEZ_LIST_MODELS/);
  assert.doesNotMatch(popup,/ZYNCEZ_LIST_MODELS/);
});

test('bubble supports drag versus click, right click, keyboard Escape, and persistent position',()=>{
  for(const segment of ['data-drag-header','pointerdown','pointermove','pointerup','attachDrag(launcher,true)','launcher.addEventListener(\'contextmenu\'','ZYNCEZ_SET_UI_PREFS','positionFromPrefs','settings-screen'])assert.ok(script.includes(segment),segment);
  assert.match(script,/Math\.hypot\(dx,dy\)>6/);
  assert.match(script,/if\(moved\)positionAt/);
  assert.match(script,/else if\(toggleOnClick\)toggle\(\)/);
  assert.match(script,/e\.key==='Escape'/);
});

test('panel animation respects reduced motion, and menu is accessible without right click',()=>{
  assert.match(css,/cubic-bezier\(\.16,1,\.3,1\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(script,/data-menu-button/);
  assert.match(script,/data-settings-close/);
  assert.match(script,/aria-expanded/);
  assert.match(css,/\.panel\.is-open/);
});

test('manifest packages Chat UI and preset list in content script order',()=>{
  const files=manifest.content_scripts[0].js;
  assert.ok(files.indexOf('src/model-catalog.js')>=0);
  assert.ok(files.indexOf('src/chat-ui.js')>=0);
  assert.ok(files.indexOf('src/model-catalog.js')<files.indexOf('src/content.js'));
  assert.ok(files.indexOf('src/chat-ui.js')<files.indexOf('src/content.js'));
});
