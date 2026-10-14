const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const code=fs.readFileSync(path.join(__dirname,'../cloud-progress.js'),'utf8');
const rows=new Map();
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const database={
  from(table){
    assert.equal(table,'game_player_progress');
    let op='read',payload,filters={};
    const query={
      select(){return query},
      eq(key,value){filters[key]=value;return query},
      insert(value){op='insert';payload=value;return query},
      update(value){op='update';payload=value;return query},
      async maybeSingle(){
        const row=rows.get(filters.user_id);
        if(op==='read')return {data:clone(row)||null,error:null};
        if(!row || row.revision!==filters.revision)return {data:null,error:null};
        const next={...row,...clone(payload)};
        rows.set(filters.user_id,next);
        return {data:{revision:next.revision},error:null};
      },
      async single(){
        if(rows.has(payload.user_id))return {data:null,error:{code:'23505'}};
        rows.set(payload.user_id,{data:clone(payload.data),revision:1});
        return {data:{revision:1},error:null};
      }
    };
    return query;
  }
};

function device(initial={},id){
  const map=new Map(Object.entries(initial).map(([k,v])=>[k,JSON.stringify(v)]));
  const store={
    getItem:key=>map.has(key)?map.get(key):null,
    setItem:(key,value)=>map.set(key,String(value)),
    removeItem:key=>map.delete(key)
  };
  const window={addEventListener(){},dispatchEvent(){},CartasGame:{refreshProgress(){}}};
  const document={querySelectorAll(){return []},querySelector(){return null},addEventListener(){},hidden:false};
  const context={window,document,localStorage:store,crypto:{randomUUID:()=>id},console,
    setTimeout,clearTimeout,Date,Math,JSON,Object,Number,String,Array,Set};
  vm.runInNewContext(code,context,{filename:'cloud-progress.js'});
  window.CartasProgress.connect(database);
  return {api:window.CartasProgress,map,
    get:key=>JSON.parse(map.get(key)||'null'),
    set:(key,value)=>map.set(key,JSON.stringify(value))};
}

(async()=>{
  const es={code:'es',nameES:'España',region:'Europe',flag:{unlocked:true,hits:2,unlockedAtISO:'2026-10-01T10:00:00Z'},capital:{unlocked:false,hits:0}};
  const initial={
    pro_player_name:'Jorge',pro_albums_v2:{es},
    pro_achievements:{primera:{date:'2026-10-01T10:00:00Z'}},
    pro_challenges:{'2026-10-13':{correct:true,countryCode:'es'}},
    pro_scores:[{dateISO:'2026-10-01T10:00:00Z',name:'Jorge',mode:'Banderas',level:'adult',theme:'Europe',score:80}],
    pro_stats:{times:{count:2,sumMs:2000,maxMs:1200,minMs:800},countries:{es:{name:'España',attempts:2,wrong:1}}}
  };
  const phone=device(initial,'phone');
  await phone.api.setUser({id:'user-a'});
  assert.equal(rows.get('user-a').data.fields.pro_albums_v2.es.flag.hits,2,'se importa el álbum anterior');
  assert.equal(rows.get('user-a').data.fields.pro_challenges['2026-10-13'].countryCode,'es','se importan los pines');
  const laptop=device({},'laptop');
  await laptop.api.setUser({id:'user-a'});
  assert.equal(laptop.get('pro_player_name'),'Jorge','otro dispositivo recupera el nombre');
  assert.equal(laptop.get('pro_albums_v2').es.flag.hits,2,'otro dispositivo recupera cartas');
  assert.equal(laptop.get('pro_achievements').primera.date,'2026-10-01T10:00:00Z','recupera logros');

  laptop.set('pro_albums_v2',{...laptop.get('pro_albums_v2'),jp:{code:'jp',nameES:'Japón',region:'Asia',flag:{unlocked:true,hits:1},capital:{unlocked:false,hits:0}}});
  laptop.set('pro_stats',{times:{count:3,sumMs:2900,maxMs:1200,minMs:800},countries:{es:{name:'España',attempts:2,wrong:1},jp:{name:'Japón',attempts:1,wrong:0}}});
  await laptop.api.flush();
  phone.set('pro_albums_v2',{es:{...phone.get('pro_albums_v2').es,flag:{...phone.get('pro_albums_v2').es.flag,hits:3}}});
  phone.set('pro_stats',{times:{count:3,sumMs:3000,maxMs:1200,minMs:800},countries:{es:{name:'España',attempts:3,wrong:1}}});
  phone.set('pro_achievements',{...phone.get('pro_achievements'),segunda:{date:'2026-10-14T10:00:00Z'}});
  await phone.api.flush();
  const merged=rows.get('user-a').data.fields;
  assert.equal(merged.pro_albums_v2.es.flag.hits,3,'las jugadas del móvil suman una sola vez');
  assert.equal(merged.pro_albums_v2.jp.flag.hits,1,'la carta del portátil permanece');
  assert.equal(merged.pro_stats.times.count,4,'las estadísticas de dos dispositivos se suman sin duplicarse');
  assert.ok(merged.pro_achievements.segunda,'el logro nuevo permanece');
  assert.ok(phone.get('pro_albums_v2').jp,'el primer dispositivo recibe la carta del segundo');
  await phone.api.flush();
  assert.equal(rows.get('user-a').data.fields.pro_stats.times.count,4,'una segunda sincronización no duplica contadores');

  phone.set('pro_albums_v2',{...phone.get('pro_albums_v2'),fr:{code:'fr',flag:{unlocked:true,hits:1},capital:{unlocked:false,hits:0}}});
  laptop.set('pro_albums_v2',{...laptop.get('pro_albums_v2'),de:{code:'de',flag:{unlocked:true,hits:1},capital:{unlocked:false,hits:0}}});
  await Promise.all([phone.api.flush(),laptop.api.flush()]);
  assert.ok(rows.get('user-a').data.fields.pro_albums_v2.fr,'una escritura simultánea no pierde Francia');
  assert.ok(rows.get('user-a').data.fields.pro_albums_v2.de,'una escritura simultánea no pierde Alemania');

  await phone.api.setUser(null);
  assert.equal(phone.get('pro_albums_v2'),null,'al salir se separa el progreso de la cuenta');
  await phone.api.setUser({id:'user-b'});
  assert.equal(rows.get('user-b').data.fields.pro_albums_v2,undefined,'otra cuenta no hereda las cartas');
  await phone.api.setUser(null);
  await phone.api.setUser({id:'user-a'});
  assert.ok(phone.get('pro_albums_v2').jp,'la primera cuenta recupera sus cartas');
  console.log('OK: migración, dos dispositivos, escrituras simultáneas, cartas/logros/estadísticas, cambio de cuenta');
})().catch(error=>{console.error(error);process.exitCode=1});
