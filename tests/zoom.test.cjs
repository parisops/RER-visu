const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('zoom keeps the page ratio, reframes after each step and cancels on close', () => {
  let frame, box, scrolls = 0, resized;
  const svg = {setAttribute(name, value){box = value.split(' ').map(Number);}};
  const c = vm.createContext({
    document:{querySelector:s => s === '.card > svg' ? svg : {appendChild(){}},
      createElement:()=>({style:{},setAttribute(){},addEventListener(){}})},
    window:{}, sheet:{classList:{contains:()=>true}},
    requestAnimationFrame:fn => {frame=fn; return 1;},
    cancelAnimationFrame:()=>{frame=null;},
    scrollElIntoView:()=>scrolls++, updateScrollSpacer(){},
    ResizeObserver:class {constructor(fn){resized=fn;} observe(){}},
    pointAt:(t)=>t.position,
    station:{querySelector:()=>({getAttribute:key=>key==='cx' ? '275' : '1920'})}
  });
  vm.runInContext(fs.readFileSync('js/zoom-view.js','utf8'),c);
  vm.runInContext('window.focusMapElement(station)',c);
  frame(0); frame(210); frame(420);
  assert.ok(Math.abs(box[2]/box[3]-620/2000)<1e-10);
  assert.ok(box[1]+box[3]<=2000);
  assert.equal(scrolls,3);
  resized();
  assert.equal(scrolls,4);
  vm.runInContext('window.followMapTrain({position:[590,40]})',c);
  assert.equal(box[0],320);
  assert.equal(box[1],0);
  vm.runInContext('window.focusMapElement(station); window.cancelMapFocus()',c);
  assert.equal(frame,null);
  resized();
  assert.equal(scrolls,4);
});
