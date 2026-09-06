const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('following ignores the animated halo and clamps at the end of the page', () => {
  let scrollY = 0, haloTop = 380;
  const calls = [];
  const node = {addEventListener(){}, getBoundingClientRect:()=>({height:200})};
  const context = vm.createContext({
    document: {getElementById:()=>node, querySelectorAll:()=>[],
      querySelector:()=>({getBoundingClientRect:()=>({height:60})}),
      documentElement:{scrollHeight:2000}},
    window: {innerHeight:800, get scrollY(){return scrollY;}, addEventListener(){},
      scrollTo({top}){calls.push(top); scrollY=top;}},
    setInterval(){},
    train: {classList:{contains:()=>true}, getScreenCTM:()=>({f:400-scrollY}),
      getBoundingClientRect:()=>({top:haloTop-scrollY})}
  });
  vm.runInContext(fs.readFileSync('js/panel.js','utf8'),context);
  vm.runInContext('scrollElIntoView(train, false)',context);
  assert.equal(scrollY,200);
  haloTop=350;
  vm.runInContext('scrollElIntoView(train, false)',context);
  assert.equal(calls.length,1);
  vm.runInContext('train.getScreenCTM = () => ({f:3000-window.scrollY}); scrollElIntoView(train,false)',context);
  assert.equal(scrollY,1200);
});
