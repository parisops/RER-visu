const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

test('two trains with the same mission code retain separate browser identities', async () => {
  const stops = [
    {station:'s:0', scheduled:'2026-09-05T12:00:00Z', expected:'2026-09-05T12:00:00Z'},
    {station:'s:1', scheduled:'2026-09-05T12:10:00Z', expected:'2026-09-05T12:10:00Z'}
  ];
  const trains = ['journey-1', 'journey-2'].map(journeyRef => ({
    journeyRef, code:'ZORU', route:'R1', dir:'B', dest:'B', stops,
    from:stops[0], to:stops[1], progress:.5
  }));
  const c = vm.createContext({
    IS_LIVE:true, ROUTES:{R1:{points:[[0,0],[10,0]], milestones:{0:'A',1:'B'}, termini:['A','B']}},
    SEG:{s:['A','B']}, SOUTH_TERMINI:[], Date, console,
    document:{getElementById:()=>({})}, followBtn:{addEventListener(){}},
    setInterval(){}, requestAnimationFrame(){},
    fetch:async()=>({ok:true,json:async()=>({trains})})
  });
  vm.runInContext(fs.readFileSync('js/trains.js','utf8'),c);
  await new Promise(setImmediate);
  assert.equal(vm.runInContext('liveTrains.length',c),2);
  assert.equal(vm.runInContext('liveTrains[0].id !== liveTrains[1].id',c),true);
  assert.equal(vm.runInContext('liveTrains.every(t => t.code === "ZORU")',c),true);
  await vm.runInContext('refreshLiveTrains()',c);
  assert.equal(vm.runInContext('liveTrains.length',c),2);
  assert.equal(vm.runInContext('ciFromWaypoints([{ci:0,time:0},{ci:10,time:1000}],500)',c),5);
});
