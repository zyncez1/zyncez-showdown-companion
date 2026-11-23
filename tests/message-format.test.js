'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {renderMarkdown}=require('../src/message-format.js');
class Node {
  constructor(tag='',value='') {this.tag=tag;this.value=value;this.children=[];this.attrs={};}
  appendChild(c){this.children.push(c);return c;}
  setAttribute(name,value){this.attrs[name]=String(value);}
  set textContent(text){this.value=String(text);this.children=[];}
  get textContent(){return this.value+this.children.map(c=>c.textContent).join('');}
  set href(v){this.attrs.href=v;}
  set target(v){this.attrs.target=v;}
  set rel(v){this.attrs.rel=v;}
  set start(v){this.attrs.start=v;}
}
const doc={createDocumentFragment:()=>new Node('fragment'),createElement:tag=>new Node(tag),createTextNode:txt=>new Node('#text',String(txt))};
function collect(root,tag){return [...(root.tag===tag?[root]:[]),...root.children.flatMap(c=>collect(c,tag))];}

test('renders title, headings, bold, emphasis, highlight, and nested formatting',()=>{
  const root=renderMarkdown('# Recommended play\n\nTry **Protect** on *Glaceon* and ==save Terastallization==.\n## Why\n**Strong *advice***',doc);
  assert.equal(collect(root,'h1')[0].textContent,'Recommended play');
  assert.equal(collect(root,'h2')[0].textContent,'Why');
  assert.equal(collect(root,'strong')[0].textContent,'Protect');
  assert.equal(collect(root,'em')[0].textContent,'Glaceon');
  assert.equal(collect(root,'mark')[0].textContent,'save Terastallization');
  assert.equal(collect(root,'strong')[1].textContent,'Strong advice');
  assert.equal(collect(root,'em')[1].textContent,'advice');
});

test('supports lists, quotes, code blocks, and safe https links',()=>{
  const root=renderMarkdown('## Options\n- Protect\n- Switch\n1. First\n2. Second\n> Be careful\n```js\nconst x = 3;\n```\nRead [rules](https://www.smogon.com).',doc);
  assert.equal(collect(root,'ul')[0].children.length,2);
  assert.equal(collect(root,'ol')[0].children.length,2);
  assert.equal(collect(root,'blockquote')[0].textContent,'Be careful');
  assert.equal(collect(root,'pre')[0].textContent,'const x = 3;');
  assert.equal(collect(root,'a')[0].attrs.target,'_blank');
  assert.equal(collect(root,'a')[0].attrs.rel,'noopener noreferrer');
});

test('malicious HTML and non-https links are never interpreted as elements',()=>{
  const root=renderMarkdown('<img src=x onerror=alert(1)> and [click me](javascript:alert(1)) and **safe**',doc);
  assert.equal(collect(root,'img').length,0);
  assert.equal(collect(root,'script').length,0);
  assert.equal(collect(root,'a').length,0);
  assert.match(root.textContent,/onerror=alert/);
  assert.equal(collect(root,'strong').length,1);
});
