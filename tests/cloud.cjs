const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const code=fs.readFileSync(path.join(__dirname,'..','cloud-leagues.js'),'utf8');
class FixedDate extends Date {
  constructor(...args){super(...(args.length?args:['2026-10-14T12:00:00Z']))}
  static now(){return Date.parse('2026-10-14T12:00:00Z')}
}

function fixture(configured=true){
  const nodes=new Map();
  const node=id=>{
    if(!nodes.has(id)) nodes.set(id,{
      value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,handlers:{},dataset:{},
      classList:{toggle(){}},addEventListener(type,callback){this.handlers[type]=callback},close(){this.closed=true}
    });
    return nodes.get(id);
  };
  const store=new Map();
  const db={game_league_members:[],game_leagues:[],game_league_attempts:[],game_league_daily:[]};
  const calls=[];
  const user={id:'player-1',email:'jorge@example.com',user_metadata:{full_name:'Jorge'}};
  let started=null;
  const client={
    auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{user}}}),
      signInWithOAuth:async()=>({error:null}),signOut:async()=>({error:null})},
    from(table){
      const predicates=[];
      const query={select(){return this},eq(field,value){predicates.push(row=>row[field]===value);return this},
        in(field,values){predicates.push(row=>values.includes(row[field]));return this},
        order(){return this},then(done){return Promise.resolve({data:db[table].filter(row=>predicates.every(fn=>fn(row))),error:null}).then(done)}};
      return query;
    },
    async rpc(method,args){
      calls.push({method,args});
      if(method==='create_game_league'){
        const league={id:'league-1',name:args.p_name,invite_code:'ABCDEF1234'};
        db.game_leagues.push(league);
        db.game_league_members.push({league_id:league.id,user_id:user.id,display_name:args.p_display_name});
        return {data:league,error:null};
      }
      if(method==='reserve_game_attempt'){
        const attempt={id:'attempt-1',league_id:args.p_league_id,user_id:user.id,
          category:args.p_category,week_start:'2026-10-12',attempt_no:1,status:'started',points:null};
        db.game_league_attempts.push(attempt);
        return {data:attempt,error:null};
      }
      if(method==='finish_game_attempt'){
        const attempt=db.game_league_attempts.find(x=>x.id===args.p_attempt_id);
        attempt.status='completed';attempt.points=args.p_hits*10;
        return {data:attempt,error:null};
      }
      if(method==='submit_game_daily'){
        db.game_league_daily.push({league_id:'league-1',user_id:user.id,day:args.p_day,
          week_start:'2026-10-12',correct:args.p_correct,clues_used:args.p_clues_used});
        return {data:1,error:null};
      }
      return {data:null,error:{message:'RPC inesperada'}};
    }
  };
  const window={CARTAS_CLOUD:configured?{url:'https://sample.supabase.co',publishableKey:'sb_publishable_example'}:{},
    supabase:{createClient:()=>client},CartasGame:{catalogReady:()=>true,dailyResult:()=>null,
      startLeagueRun:args=>{started=args;return true}}};
  const localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
  const context=vm.createContext({window,document:{querySelector:node},localStorage,
    location:{href:'https://example.github.io/game/',search:''},URL,URLSearchParams,
    Intl,Date:FixedDate,setTimeout,console,navigator:{clipboard:{writeText:async()=>{}}}});
  node('#cloudRankingMode').value='total';
  vm.runInContext(code,context);
  return {node,window,store,db,calls,get started(){return started}};
}

async function main(){
  const disconnected=fixture(false);
  assert.equal(disconnected.node('#cloudSignIn').disabled,true);
  assert.match(disconnected.node('#cloudStatus').textContent,/Falta conectar/);

  const app=fixture();
  await new Promise(resolve=>setTimeout(resolve,10));
  app.node('#cloudNewLeague').value='Amigos del mundo';
  await app.node('#cloudCreate').handlers.click();
  assert.match(app.node('#cloudLeagueList').innerHTML,/Amigos del mundo/);
  assert.match(app.node('#cloudChallenges').innerHTML,/Supervivencia · Mixto/);
  await app.node('#cloudChallenges').handlers.click({target:{closest:()=>({dataset:{cloudPlay:'flags'}})}});
  assert.equal(app.started.category,'flags');
  assert(['Europe','Asia','Americas','Africa','Oceania'].includes(app.started.theme));
  assert.equal(app.node('#leagueModal').closed,true);
  await app.window.CloudLeagues.submitRun({attemptId:'attempt-1',hits:8,misses:2,total:10,studyFirstHits:0,durationMs:42000});
  assert.equal(app.db.game_league_attempts[0].points,80);
  assert.match(app.node('#cloudLeaderboard').innerHTML,/>80</);
  assert.equal(JSON.parse(app.store.get('cartas_pending_league_results')).length,0);
  assert(app.calls.some(x=>x.method==='reserve_game_attempt'));
  assert(app.calls.some(x=>x.method==='finish_game_attempt'));
  console.log('OK: configuración pendiente, creación, reto, resultado y clasificación en nube simulada');
}
main().catch(error=>{console.error(error);process.exitCode=1});
