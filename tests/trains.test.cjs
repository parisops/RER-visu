const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  let payload = {generatedAt:'2026-09-05T12:00:00Z',trains:[]};
  const context = vm.createContext({
    IS_LIVE:true, ROUTES:{R1:{points:[[0,0],[10,0],[20,0]],
      milestones:{0:'A',1:'B',2:'C'},termini:['A','C']}},
    SEG:{s:['A','B','C']}, SOUTH_TERMINI:[], Date, console,
    document:{getElementById:()=>({})}, followBtn:{addEventListener(){}},
    selectedTrain:null, closeSheet(){}, setInterval(){}, requestAnimationFrame(){},
    fetch:async()=>({ok:true,json:async()=>payload})
  });
  vm.runInContext(fs.readFileSync('js/trains.js','utf8'),context);
  return {run: code=>vm.runInContext(code,context),set: value=>{payload=value;}};
}
const train = {journeyRef:'j1',route:'R1',dest:'B',code:'TEST',dir:'A',stops:[
  {station:'s:0',expected:'2026-09-05T12:00:00Z'},
  {station:'s:2',expected:'2026-09-05T12:10:00Z'}
]};
test('continuous interpolation in both directions between network updates',()=>{
  const c=setup();
  assert.equal(c.run('ciFromWaypoints([{ci:0,time:0},{ci:10,time:600000}],150000)'),2.5);
  assert.equal(c.run('ciFromWaypoints([{ci:10,time:0},{ci:0,time:600000}],450000)'),2.5);
  assert.equal(c.run('ciFromWaypoints([{ci:0,time:0},{ci:10,time:600000}],900000)'),10);
});
test('invalid routes cannot create markers; direction comes from stop order',async()=>{
  const c=setup(); await new Promise(setImmediate);
  c.set({generatedAt:'2026-09-05T12:01:00Z',trains:[{...train,route:null},{...train,route:'missing'},train]});
  await c.run('refreshLiveTrains()');
  assert.equal(c.run('liveTrains.length'),1);
  assert.equal(c.run('liveTrains[0].dir'),1);
  assert.equal(c.run('currentDestination(liveTrains[0])'),'B');
  c.run('globalThis.original = liveTrains[0]');
  c.set({generatedAt:'2026-09-05T12:02:00Z',trains:[{...train,stops:[
    {station:'s:1',expected:'2026-09-05T12:05:00Z'}, train.stops[1]
  ]}]});
  await c.run('refreshLiveTrains()');
  assert.equal(c.run('liveTrains[0] === original'),true);
  assert.equal(c.run('liveTrains[0].waypoints.length'),3);
  c.set({generatedAt:'2026-09-05T12:02:00Z',trains:[]});
  await c.run('refreshLiveTrains()');
  assert.equal(c.run('liveTrains.length'),1);
});
test('departures cache expires and freshness uses the source timestamp',async()=>{
  let now=Date.parse('2026-09-05T12:00:00Z'),calls=0;
  class Clock extends Date {static now(){return now;}}
  const c=vm.createContext({Date:Clock,console,fetch:async()=>{
    calls++; return {ok:true,json:async()=>({generatedAt:'2026-09-05T11:40:00Z',stations:{}})};
  }});
  vm.runInContext(fs.readFileSync('js/real-schedule.js','utf8'),c);
  await vm.runInContext('loadLiveData()',c);
  await vm.runInContext('loadLiveData()',c);
  assert.equal(calls,1);
  assert.match(vm.runInContext('liveFreshnessText()',c),/données anciennes \(20 min\)/);
  now+=61000;
  await vm.runInContext('loadLiveData()',c);
  assert.equal(calls,2);
});
