// Progreso personal: conserva el juego local y sincroniza cada cuenta de Google.
(() => {
  const keys = [
    'pro_player_name','pro_scores','pro_stats','pro_challenges',
    'pro_daily_progress_v1','pro_last_sel','pro_achievements',
    'pro_albums_v2','pro_visited_regions_v1','pro_streak_v1'
  ];
  const keySet = new Set(keys);
  const ownerKey = 'cartas_progress_owner_v1';
  const deviceKey = 'cartas_progress_device_v1';
  const accountKey = id => 'cartas_progress_local_' + id;
  const baseKey = id => 'cartas_progress_base_' + id;
  const emptyStats = () => ({times:{count:0,sumMs:0,maxMs:0,minMs:0},countries:{}});
  const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const array = value => Array.isArray(value) ? value : [];
  const number = value => Number.isFinite(Number(value)) ? Math.max(0,Number(value)) : 0;
  const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const stable = value => JSON.stringify(value, function(_key, item){
    if(item && typeof item === 'object' && !Array.isArray(item))
      return Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]]));
    return item;
  });
  const same = (a,b) => stable(a) === stable(b);
  const earliest = (a,b) => a && b ? (a < b ? a : b) : a || b;
  const largest = (a,b) => Math.max(number(a),number(b));
  const positiveMin = (a,b) => [number(a),number(b)].filter(Boolean).sort((x,y)=>x-y)[0] || 0;

  function readFields(){
    const fields={};
    for(const key of keys){
      try {const raw=localStorage.getItem(key);if(raw!==null)fields[key]=JSON.parse(raw)}
      catch { /* Un valor local corrupto no se sube a la cuenta. */ }
    }
    return fields;
  }
  function readMeta(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
  function writeMeta(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
  function renderStatus(message){
    document.querySelectorAll('.profile-sync-status').forEach(el=>el.textContent=message);
    const league=document.querySelector('#cloudProgressStatus');
    if(league)league.textContent=message;
  }
  function refreshGame(){window.CartasGame?.refreshProgress?.()}
  function replaceFields(fields){
    for(const key of keys){
      try{
        if(Object.hasOwn(fields,key))localStorage.setItem(key,JSON.stringify(fields[key]));
        else localStorage.removeItem(key);
      }catch{}
    }
    refreshGame();
  }

  function mergeAlbum(remote,local,base,newImport){
    const result=copy(obj(remote));
    for(const [code,entry] of Object.entries(obj(local))){
      if(!entry || typeof entry!=='object')continue;
      const old=obj(result[code]), previous=obj(obj(base)[code]);
      const merged={...copy(entry),...old};
      for(const side of ['flag','capital']){
        const r=obj(old[side]), l=obj(entry[side]), b=obj(previous[side]);
        const amount=newImport ? number(l.hits) :
          base ? Math.max(0,number(l.hits)-number(b.hits)) : 0;
        merged[side]={...l,...r,
          unlocked:!!(r.unlocked || l.unlocked),
          hits:newImport || base ? number(r.hits)+amount : largest(r.hits,l.hits)};
        const date=earliest(r.unlockedAtISO,l.unlockedAtISO);
        if(date)merged[side].unlockedAtISO=date;
        if(side==='capital')merged[side].value=r.value || l.value || '';
      }
      if(!same(entry.favorite,previous.favorite))merged.favorite=!!entry.favorite;
      else merged.favorite=!!old.favorite;
      result[code]=merged;
    }
    return result;
  }
  function mergeStats(remote,local,base,newImport){
    const r=obj(remote), l=obj(local), b=obj(base);
    const rt=obj(r.times), lt=obj(l.times), bt=obj(b.times);
    const add=(rv,lv,bv)=>newImport || base ? number(rv)+Math.max(0,number(lv)-number(bv)) : largest(rv,lv);
    const times={count:add(rt.count,lt.count,bt.count),sumMs:add(rt.sumMs,lt.sumMs,bt.sumMs),
      maxMs:largest(rt.maxMs,lt.maxMs),minMs:positiveMin(rt.minMs,lt.minMs)};
    const countries=copy(obj(r.countries));
    for(const [code,item] of Object.entries(obj(l.countries))){
      const rc=obj(countries[code]), lc=obj(item), bc=obj(obj(b.countries)[code]);
      countries[code]={name:rc.name || lc.name || code,
        attempts:add(rc.attempts,lc.attempts,bc.attempts),
        wrong:add(rc.wrong,lc.wrong,bc.wrong)};
    }
    return {times,countries};
  }
  function mergeScores(remote,local){
    const rows=new Map();
    for(const row of [...array(remote),...array(local)]){
      if(!row || typeof row!=='object')continue;
      const id=[row.dateISO,row.name,row.mode,row.level,row.theme,row.score].join('|');
      if(!rows.has(id))rows.set(id,row);
    }
    return [...rows.values()].sort((a,b)=>String(b.dateISO||'').localeCompare(String(a.dateISO||''))).slice(0,300);
  }
  function mergeData(remote,localFields,base,deviceId){
    const r=obj(remote), rf=obj(r.fields), bf=obj(obj(base).fields);
    const imports=new Set(array(r.imports).filter(x=>typeof x==='string'));
    const newImport=!base && !imports.has(deviceId);
    const fields={};
    for(const key of keys){
      const local=localFields[key], cloud=rf[key], previous=bf[key];
      if(local===undefined || (base && same(local,previous))){
        if(cloud!==undefined)fields[key]=copy(cloud);
        continue;
      }
      if(cloud===undefined){fields[key]=copy(local);continue}
      if(key==='pro_albums_v2')fields[key]=mergeAlbum(cloud,local,base ? previous : null,newImport);
      else if(key==='pro_stats')fields[key]=mergeStats(cloud,local,base ? previous : null,newImport);
      else if(key==='pro_scores')fields[key]=mergeScores(cloud,local);
      else if(key==='pro_achievements'){
        fields[key]=copy(obj(cloud));
        for(const [id,earned] of Object.entries(obj(local))){
          const old=fields[key][id];
          fields[key][id]=old ? {...old,date:earliest(old.date,earned?.date)} : copy(earned);
        }
      }else if(key==='pro_challenges')fields[key]={...obj(local),...obj(cloud)};
      else if(key==='pro_visited_regions_v1')fields[key]={...obj(cloud),...obj(local)};
      else if(key==='pro_daily_progress_v1'){
        const c=obj(cloud),l=obj(local);
        fields[key]=c.day===l.day && c.code===l.code ?
          {...c,...l,revealed:largest(c.revealed,l.revealed)} :
          (String(l.day||'')>String(c.day||'') ? copy(local) : copy(cloud));
      }else if(key==='pro_streak_v1')fields[key]=base ? copy(local) : largest(cloud,local);
      else fields[key]=base || !cloud ? copy(local) : copy(cloud);
    }
    imports.add(deviceId);
    return {schema:1,fields,imports:[...imports].sort()};
  }

  const deviceId=(()=>{
    let id=localStorage.getItem(deviceKey);
    if(!id){id=globalThis.crypto?.randomUUID?.() || 'device-'+Date.now()+'-'+Math.random();localStorage.setItem(deviceKey,id)}
    return id;
  })();
  let client=null, userId=null, generation=0, syncing=false, again=false, timer=null;
  function schedule(){
    if(!client||!userId)return;
    clearTimeout(timer);
    timer=setTimeout(()=>{sync().catch(()=>{})},700);
  }
  async function sync(){
    if(!client||!userId)return;
    if(syncing){again=true;return}
    syncing=true;
    const id=userId, turn=generation;
    try{
      do{
        again=false;
        const captured=readFields();
        const base=readMeta(baseKey(id));
        let applied=false;
        renderStatus('☁ Guardando progreso…');
        for(let attempt=0;attempt<5;attempt++){
          const fetched=await client.from('game_player_progress').select('data,revision').eq('user_id',id).maybeSingle();
          if(fetched.error)throw fetched.error;
          if(turn!==generation)return;
          const row=fetched.data, merged=mergeData(row?.data,captured,base,deviceId);
          let saved=true;
          if(!row){
            const inserted=await client.from('game_player_progress').insert({user_id:id,data:merged}).select('revision').single();
            if(inserted.error){if(inserted.error.code==='23505')continue;throw inserted.error}
          }else if(!same(merged,row.data)){
            const updated=await client.from('game_player_progress')
              .update({data:merged,revision:Number(row.revision)+1,updated_at:new Date().toISOString()})
              .eq('user_id',id).eq('revision',row.revision).select('revision').maybeSingle();
            if(updated.error)throw updated.error;
            saved=!!updated.data;
          }
          if(!saved)continue;
          if(turn!==generation)return;
          // Una respuesta o carta conseguida durante la petición no se sobrescribe.
          const current=readFields(), next={...current};
          for(const key of keys){
            if(!same(current[key],captured[key])){again=true;continue}
            if(Object.hasOwn(merged.fields,key))next[key]=merged.fields[key];
            else delete next[key];
          }
          writeMeta(baseKey(id),merged);
          writeMeta(accountKey(id),next);
          replaceFields(next);
          renderStatus('☁ Progreso guardado en tu cuenta');
          applied=true;
          break;
        }
        if(!applied)throw new Error('El progreso ha cambiado en otro dispositivo. Inténtalo de nuevo.');
      }while(again && id===userId && turn===generation);
    }catch(error){
      if(turn===generation){renderStatus('☁ Cambios pendientes de guardar. Reintentaremos al volver la conexión.');console.warn('Sincronización de progreso:',error)}
      throw error;
    }finally{syncing=false;if(again&&id===userId&&turn===generation)schedule()}
  }
  async function setUser(user){
    const next=user?.id || null;
    if(next===userId){if(next)schedule();return}
    clearTimeout(timer);
    generation++;
    const old=localStorage.getItem(ownerKey);
    if(old && old!==next)writeMeta(accountKey(old),readFields());
    if(old!==next){
      if(next){
        if(old)replaceFields(obj(readMeta(accountKey(next))));
        // Sin propietario anterior: importa el progreso local al primer Google usado.
        localStorage.setItem(ownerKey,next);
      }else if(old){
        replaceFields({});
        localStorage.removeItem(ownerKey);
      }
    }
    userId=next;
    if(next){
      renderStatus('☁ Conectando tu progreso…');
      await sync().catch(()=>{});
    }else renderStatus('☁ Entra con Google desde Liga para guardar tu progreso.');
  }
  window.addEventListener('cartas:progress-local-change',event=>{
    if(keySet.has(event.detail?.key))schedule();
  });
  window.addEventListener('storage',event=>{if(keySet.has(event.key))schedule()});
  window.addEventListener('online',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
  window.CartasProgress={
    connect(supabase){client=supabase},setUser,flush:sync,
    mergeData,readFields
  };
  renderStatus('☁ Entra con Google desde Liga para guardar tu progreso.');
})();
