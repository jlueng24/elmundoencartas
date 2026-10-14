// Ligas privadas: Google + Supabase. El juego libre sigue funcionando sin configuración.
(() => {
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cfg = window.CARTAS_CLOUD || {};
  const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url || '') &&
    typeof cfg.publishableKey === 'string' && cfg.publishableKey.length > 10 && !!window.supabase;
  const client = ready ? window.supabase.createClient(cfg.url,cfg.publishableKey) : null;
  const categoryNames = {
    flags:'Banderas',capitals:'Capitales',mixed:'Mixto',study:'Estudio',
    survival_flags:'Supervivencia · Banderas',
    survival_capitals:'Supervivencia · Capitales',
    survival_mixed:'Supervivencia · Mixto'
  };
  const themes = ['Europe','Asia','Americas','Africa','Oceania'];
  const themeNames = {Europe:'Europa',Asia:'Asia',Americas:'América',Africa:'África',Oceania:'Oceanía'};
  let user = null, leagues = [], active = null, members = [], attempts = [], daily = [];
  let flushing = false, busy = false;

  function madridDay(){
    const pieces = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const part = type => pieces.find(p=>p.type===type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  function weekStart(){
    const date = new Date(madridDay()+'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay()+6)%7));
    return date.toISOString().slice(0,10);
  }
  function weekTheme(week){
    return themes[((Math.floor(Date.parse(week+'T00:00:00Z')/604800000)%5)+5)%5];
  }
  function status(message,error=false){
    const el=$('#cloudStatus');
    el.textContent=message;
    el.classList.toggle('is-error',error);
  }
  function name(){
    return ($('#playerName').value.trim() || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Jugador').slice(0,24);
  }
  function showAuth(){
    $('#cloudSignedOut').hidden=!!user;
    $('#cloudSignedIn').hidden=!user;
    $('#cloudAccount').textContent=user?.email || '';
    $('#cloudLeagueArea').hidden=!user;
  }
  async function check(result){
    if(result.error) throw new Error(result.error.message);
    return result.data;
  }
  function categoryBest(rows,category){
    return Math.max(0,...rows.filter(row=>row.category===category && row.status==='completed')
      .map(row=>row.points || 0));
  }
  function ranking(){
    const rows=members.map(member=>{
      const own=attempts.filter(a=>a.user_id===member.user_id);
      const points=Object.fromEntries(Object.keys(categoryNames).map(key=>[key,categoryBest(own,key)]));
      const solved=daily.filter(d=>d.user_id===member.user_id && d.correct).length;
      const mystery=solved*10;
      const survival=Math.round((points.survival_flags+points.survival_capitals+points.survival_mixed)/3);
      return {name:member.display_name,points,mystery,survival,
        total:points.flags+points.capitals+points.mixed+points.study+survival+mystery,
        solved};
    });
    rows.sort((a,b)=>b.total-a.total || b.solved-a.solved || a.name.localeCompare(b.name,'es'));
    return rows;
  }
  function renderRanking(){
    const mode=$('#cloudRankingMode').value;
    const value=row=>mode==='total'?row.total:mode==='survival'?row.survival:
      mode==='mystery'?row.mystery:row.points[mode] || 0;
    const rows=ranking().sort((a,b)=>value(b)-value(a) || b.total-a.total || a.name.localeCompare(b.name,'es'));
    if(!rows.length){$('#cloudLeaderboard').innerHTML='<p class="cloud-empty">Todavía no hay jugadores en esta liga.</p>';return}
    if(mode!=='total'){
      $('#cloudLeaderboard').innerHTML=`<table><thead><tr><th>#</th><th>Jugador</th><th>Puntos</th></tr></thead><tbody>${rows.map((row,i)=>
        `<tr><td>${i+1}</td><td>${escape(row.name)}</td><td><strong>${value(row)}</strong></td></tr>`).join('')}</tbody></table>`;
      return;
    }
    const head='<tr><th>#</th><th>Jugador</th><th>Total</th><th>⚑</th><th>▥</th><th>⇄</th><th>⚡</th><th>✎</th><th>✦</th></tr>';
    $('#cloudLeaderboard').innerHTML=`<table><thead>${head}</thead><tbody>${rows.map((row,i)=>
      `<tr><td>${i+1}</td><td>${escape(row.name)}</td><td><strong>${row.total}</strong></td>
      <td>${row.points.flags}</td><td>${row.points.capitals}</td><td>${row.points.mixed}</td>
      <td>${row.survival}</td><td>${row.points.study}</td><td>${row.mystery}</td></tr>`).join('')}</tbody></table>`;
  }
  function renderChallenges(){
    const theme=weekTheme(weekStart());
    $('#cloudChallengeNote').textContent=`Semana del ${weekStart()} · ${themeNames[theme]} · Adultos · hasta 3 intentos por reto. Todos reciben las mismas preguntas.`;
    const available=window.CartasGame?.catalogReady();
    $('#cloudChallenges').innerHTML=Object.entries(categoryNames).map(([key,label])=>{
      const own=attempts.filter(a=>a.user_id===user?.id && a.category===key);
      const best=categoryBest(own,key);
      const left=3-own.length;
      return `<div class="cloud-challenge"><div><strong>${escape(label)}</strong><small>Mejor: ${best}/100 · ${left} ${left===1?'intento':'intentos'}</small></div>
        <button type="button" data-cloud-play="${key}" ${left<1||!available?'disabled':''}>Jugar</button></div>`;
    }).join('');
    if(!available) $('#cloudChallengeNote').textContent+=' Conecta el catálogo mundial para jugar retos puntuables.';
  }
  function renderLeagues(){
    $('#cloudLeagueList').innerHTML=leagues.length ? leagues.map(league=>
      `<button type="button" data-cloud-league="${league.id}" class="${league.id===active?.id?'selected':''}">${escape(league.name)}</button>`).join('') :
      '<span>Aún no perteneces a ninguna liga.</span>';
    $('#cloudActiveLeague').hidden=!active;
    if(active){
      $('#cloudLeagueTitle').textContent=active.name;
      $('#cloudInviteCode').textContent=active.invite_code;
      renderRanking();renderChallenges();
    }
  }
  async function refresh(){
    if(!client||!user)return;
    try{
      const joined=await check(await client.from('game_league_members').select('league_id').eq('user_id',user.id));
      const ids=joined.map(x=>x.league_id);
      leagues=ids.length ? await check(await client.from('game_leagues').select('id,name,invite_code').in('id',ids).order('created_at')) : [];
      active=leagues.find(x=>x.id===localStorage.getItem('cartas_active_league')) || leagues[0] || null;
      if(active){
        const week=weekStart();
        const [m,a,d]=await Promise.all([
          client.from('game_league_members').select('user_id,display_name').eq('league_id',active.id),
          client.from('game_league_attempts').select('user_id,category,points,status').eq('league_id',active.id).eq('week_start',week),
          client.from('game_league_daily').select('user_id,correct,clues_used').eq('league_id',active.id).eq('week_start',week)
        ]);
        members=await check(m);attempts=await check(a);daily=await check(d);
      }else{members=[];attempts=[];daily=[];}
      renderLeagues();
      status('Clasificación actualizada.');
    }catch(error){status(error.message,true)}
  }
  async function action(callback){
    if(busy)return;
    busy=true;
    try{await callback()}catch(error){status(error.message,true)}finally{busy=false}
  }
  async function saveResult(result){
    return check(await client.rpc('finish_game_attempt',{
      p_attempt_id:result.attemptId,p_hits:result.hits,p_misses:result.misses,
      p_total:result.total,p_study_first_hits:result.studyFirstHits,p_duration_ms:result.durationMs
    }));
  }
  async function flushPending(){
    if(flushing||!client||!user)return;
    flushing=true;
    try{
      const pending=JSON.parse(localStorage.getItem('cartas_pending_league_results')||'[]');
      const remaining=[];
      for(const result of pending){
        try{await saveResult(result)}catch(error){remaining.push(result);status('Resultado pendiente de subir: '+error.message,true)}
      }
      localStorage.setItem('cartas_pending_league_results',JSON.stringify(remaining));
      if(pending.length && !remaining.length){status('Resultado guardado en la liga.');await refresh()}
    }finally{flushing=false}
  }
  window.CloudLeagues={
    async submitRun(result){
      const pending=JSON.parse(localStorage.getItem('cartas_pending_league_results')||'[]');
      if(!pending.some(x=>x.attemptId===result.attemptId)) pending.push(result);
      localStorage.setItem('cartas_pending_league_results',JSON.stringify(pending));
      await flushPending();
    },
    async submitDaily(day,result){
      if(!client||!user||!leagues.length||day!==madridDay())return;
      try{
        await check(await client.rpc('submit_game_daily',{
          p_day:day,p_correct:!!result.correct,p_clues_used:result.cluesUsed ?? 0
        }));
        await refresh();
      }catch(error){status('El misterio aún no se ha sincronizado: '+error.message,true)}
    }
  };

  $('#cloudSignIn').addEventListener('click',()=>action(async()=>{
    status('Abriendo Google…');
    const page=new URL(location.href);
    const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:page.origin+page.pathname}});
    if(error)throw error;
  }));
  $('#cloudSignOut').addEventListener('click',()=>action(async()=>{
    await check(await client.auth.signOut());
    user=null;leagues=[];active=null;showAuth();renderLeagues();status('Sesión cerrada.');
  }));
  $('#cloudCreate').addEventListener('click',()=>action(async()=>{
    const title=$('#cloudNewLeague').value.trim();
    if(title.length<2)throw new Error('Escribe un nombre para la liga.');
    const league=await check(await client.rpc('create_game_league',{p_name:title,p_display_name:name()}));
    localStorage.setItem('cartas_active_league',league.id);
    $('#cloudNewLeague').value='';await refresh();status('Liga creada. Comparte el código con tus amigos.');
  }));
  $('#cloudJoin').addEventListener('click',()=>action(async()=>{
    const code=$('#cloudJoinCode').value.trim().toUpperCase();
    if(!/^[A-F0-9]{10}$/.test(code))throw new Error('Introduce un código de diez caracteres.');
    const league=await check(await client.rpc('join_game_league',{p_code:code,p_display_name:name()}));
    localStorage.setItem('cartas_active_league',league.id);
    localStorage.removeItem('cartas_invite_code');
    $('#cloudJoinCode').value='';await refresh();status('Ya formas parte de '+league.name+'.');
    const result=window.CartasGame?.dailyResult();
    if(result)window.CloudLeagues.submitDaily(madridDay(),result);
  }));
  $('#cloudLeagueList').addEventListener('click',e=>{
    const button=e.target.closest('[data-cloud-league]');
    if(!button)return;
    localStorage.setItem('cartas_active_league',button.dataset.cloudLeague);refresh();
  });
  $('#cloudRankingMode').addEventListener('change',renderRanking);
  $('#cloudChallenges').addEventListener('click',e=>action(async()=>{
    const button=e.target.closest('[data-cloud-play]');
    if(!button||button.disabled||!active)return;
    const category=button.dataset.cloudPlay;
    const attempt=await check(await client.rpc('reserve_game_attempt',{
      p_league_id:active.id,p_category:category
    }));
    const started=window.CartasGame.startLeagueRun({leagueId:active.id,attemptId:attempt.id,
      week:attempt.week_start,category,theme:weekTheme(attempt.week_start)});
    if(started){$('#leagueModal').close();status('Intento '+attempt.attempt_no+' iniciado.');}
    else{status('No se pudo iniciar el reto. El intento queda reservado; comprueba el catálogo.',true)}
  }));
  $('#cloudRefresh').addEventListener('click',()=>{flushPending();refresh()});
  $('#btnLeague').addEventListener('click',()=>{flushPending();refresh()});
  $('#cloudShare').addEventListener('click',()=>action(async()=>{
    if(!active)return;
    const link=new URL(location.href);link.search='';link.hash='';link.searchParams.set('liga',active.invite_code);
    const text=`Únete a mi liga «${active.name}» en Cartas del Mundo. Código: ${active.invite_code}\n${link}`;
    if(navigator.share){try{await navigator.share({text})}catch(error){if(error.name!=='AbortError')throw error}}
    else{await navigator.clipboard.writeText(text);status('Invitación copiada.');}
  }));

  const invite=new URLSearchParams(location.search).get('liga') || localStorage.getItem('cartas_invite_code');
  if(invite && /^[a-f0-9]{10}$/i.test(invite)) localStorage.setItem('cartas_invite_code',invite.toUpperCase());
  if(invite && /^[a-f0-9]{10}$/i.test(invite)) $('#cloudJoinCode').value=invite.toUpperCase();
  if(!ready){
    $('#cloudSignedOut').hidden=false;
    $('#cloudSignIn').disabled=true;
    $('#cloudLeagueArea').hidden=true;
    status('Las ligas en la nube están preparadas. Falta conectar el proyecto Supabase en cloud-config.js.',true);
    return;
  }
  client.auth.onAuthStateChange((_event,session)=>{
    user=session?.user || null;showAuth();
    if(user)setTimeout(async()=>{
      await flushPending();await refresh();
      const result=window.CartasGame?.dailyResult();
      if(result)window.CloudLeagues.submitDaily(madridDay(),result);
    },0);
  });
  client.auth.getSession().then(({data})=>{user=data.session?.user||null;showAuth();if(user)refresh()});
  showAuth();
})();
