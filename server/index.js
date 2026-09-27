import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PORT=Number(process.env.PORT||10000);
const DAILY_API_KEY=process.env.DAILY_API_KEY||"";
const DAILY_DOMAIN=process.env.DAILY_DOMAIN||"ezouservicesmeeting.daily.co";
const ALLOWED_ORIGINS=(process.env.ALLOWED_ORIGINS||"*").split(",").map(s=>s.trim()).filter(Boolean);
const rate=new Map();
setInterval(()=>{const cutoff=Date.now()-60000;for(const [k,v] of rate)if(v.start<cutoff)rate.delete(k)},60000).unref?.();

function cors(origin){
 const allow=ALLOWED_ORIGINS.includes("*")||ALLOWED_ORIGINS.includes(origin)?(ALLOWED_ORIGINS.includes("*")?"*":origin):ALLOWED_ORIGINS[0]||"*";
 return {"Access-Control-Allow-Origin":allow,"Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"};
}
function json(res,status,data,origin){
 for(const [k,v] of Object.entries(cors(origin)))res.setHeader(k,v);
 res.setHeader("Content-Type","application/json; charset=utf-8");
 res.statusCode=status;res.end(JSON.stringify(data));
}
function clientKey(req){return (req.headers["x-forwarded-for"]||req.socket.remoteAddress||"unknown").toString().split(",")[0].trim()}
function allowed(req){
 const now=Date.now(),key=clientKey(req),entry=rate.get(key);
 if(!entry||now-entry.start>60000){rate.set(key,{start:now,count:1});return true}
 if(entry.count>=30)return false;entry.count++;return true;
}
function safe(s,max=80){return String(s||"").trim().replace(/[^a-zA-Z0-9_-]/g,"-").slice(0,max)}
async function dailyRequest(method,path,body){
 const r=await fetch("https://api.daily.co/v1"+path,{method,headers:{"Authorization":"Bearer "+DAILY_API_KEY,"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(data.info||data.error||"Daily API error");e.status=r.status;e.dailyCode=data.error||data.info||"";throw e}
 return data;
}
async function daily(path,body){return dailyRequest("POST",path,body)}
let dailyReady=false;
async function verifyDaily(){try{await dailyRequest("GET","/");dailyReady=true;console.log("Daily connectivity check: OK",DAILY_DOMAIN)}catch(e){dailyReady=false;console.error("Daily connectivity check failed:",{status:e.status||0,code:e.dailyCode||"",message:e.message||""})}}
async function getExistingRoom(roomName){
 const existing=await dailyRequest("GET","/rooms/"+encodeURIComponent(roomName));
 return {roomName:existing.name||roomName,url:existing.url||("https://"+DAILY_DOMAIN+"/"+encodeURIComponent(roomName)),exp:Number(existing.config?.exp||Math.floor(Date.now()/1000)+24*60*60)};
}
async function createRoom(code,title){
 const roomName="ruunion-"+safe(code,40).toLowerCase();
 const exp=Math.floor(Date.now()/1000)+24*60*60;
 try{
  const data=await daily("/rooms",{name:roomName,privacy:"private",properties:{exp,enable_prejoin_ui:true,start_video_off:true,start_audio_off:true,enable_screenshare:true,enable_chat:true,enable_noise_cancellation_ui:true,lang:"fr"}});
  return {roomName:data.name||roomName,url:data.url||("https://"+DAILY_DOMAIN+"/"+encodeURIComponent(roomName)),exp};
 }catch(e){
  if(e.status===409){
   try{
    const existing=await dailyRequest("GET","/rooms/"+encodeURIComponent(roomName));
    return {roomName:existing.name||roomName,url:existing.url||("https://"+DAILY_DOMAIN+"/"+encodeURIComponent(roomName)),exp};
   }catch(existingError){throw e}
  }
  throw e;
 }
}
async function createToken(roomName,name,email,exp,moderator){
 const userId=crypto.createHash("sha256").update((email||name||"guest")+"|"+roomName).digest("hex").slice(0,32);
 const data=await daily("/meeting-tokens",{properties:{room_name:roomName,eject_at_token_exp:true,exp,is_owner:!!moderator,user_name:safe(name||"Invité",80),user_id:userId,enable_screenshare:true,start_video_off:true,start_audio_off:true,enable_prejoin_ui:true,lang:"fr"}});
 return data.token;
}
async function handle(req,res){
 const origin=req.headers.origin||"";
 if(req.method==="OPTIONS"){for(const[k,v]of Object.entries(cors(origin)))res.setHeader(k,v);res.statusCode=204;return res.end()}
 if(req.method==="GET"&&req.url==="/health")return json(res,dailyReady?200:503,{ok:dailyReady,service:"RUUNION DIRECT Daily API",domain:DAILY_DOMAIN,daily:dailyReady?"reachable":"unreachable"},origin);
 if(req.method==="GET"&&(req.url==="/"||req.url.startsWith("/index.html"))){try{const html=fs.readFileSync(path.join(process.cwd(),"app/src/main/assets/index.html"),"utf8");for(const[k,v]of Object.entries(cors(origin)))res.setHeader(k,v);res.setHeader("Content-Type","text/html; charset=utf-8");res.statusCode=200;return res.end(html)}catch(e){return json(res,500,{error:"web_unavailable"},origin)}}
 if(req.method==="GET"&&req.url==="/manifest.webmanifest"){try{const x=fs.readFileSync(path.join(process.cwd(),"app/src/main/assets/manifest.webmanifest"));for(const[k,v]of Object.entries(cors(origin)))res.setHeader(k,v);res.setHeader("Content-Type","application/manifest+json");res.statusCode=200;return res.end(x)}catch(e){return json(res,404,{error:"not_found"},origin)}}
 if(req.method==="GET"&&req.url==="/sw.js"){try{const x=fs.readFileSync(path.join(process.cwd(),"app/src/main/assets/sw.js"));for(const[k,v]of Object.entries(cors(origin)))res.setHeader(k,v);res.setHeader("Content-Type","application/javascript");res.statusCode=200;return res.end(x)}catch(e){return json(res,404,{error:"not_found"},origin)}}
 if(req.method==="GET"&&req.url==="/ruunion-logo.png"){try{const x=fs.readFileSync(path.join(process.cwd(),"app/src/main/assets/ruunion-logo.png"));for(const[k,v]of Object.entries(cors(origin)))res.setHeader(k,v);res.setHeader("Content-Type","image/png");res.statusCode=200;return res.end(x)}catch(e){return json(res,404,{error:"not_found"},origin)}}
 if(req.method!=="POST"||req.url!=="/meeting")return json(res,404,{error:"not_found"},origin);
 if(!DAILY_API_KEY)return json(res,503,{error:"not_configured",message:"Daily API non configurée côté serveur."},origin);
 if(!allowed(req))return json(res,429,{error:"rate_limited",message:"Trop de demandes. Réessayez dans une minute."},origin);
 let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>10000)break}
 if(raw.length>10000)return json(res,413,{error:"payload_too_large"},origin);
 let body;try{body=JSON.parse(raw)}catch{return json(res,400,{error:"invalid_json"},origin)}
 const code=safe(body.code,40).toLowerCase(),requestedRoom=safe(body.roomName,100).toLowerCase(),name=safe(body.name,80)||"Invité",email=String(body.email||"").trim().slice(0,160),moderator=body.moderator===true;
 if(!code&&!requestedRoom)return json(res,400,{error:"invalid_code",message:"Lien ou code de réunion manquant."},origin);
 try{
  const room=requestedRoom?await getExistingRoom(requestedRoom):await createRoom(code,safe(body.title,120));
  const token=await createToken(room.roomName,name,email,room.exp,moderator);
  return json(res,200,{ok:true,roomName:room.roomName,url:room.url,token,code:code||requestedRoom.replace(/^ruunion-/,""),title:safe(body.title,120)||"RUUNION DIRECT",expiresAt:room.exp},origin);
 }catch(e){
  console.error("Daily meeting preparation failed:",{status:e.status||0,code:e.dailyCode||"",message:e.message||""});
  const message=e.status===401||e.status===403?"Le service Daily refuse l’accès du serveur. Vérifiez la clé Daily dans Render.":e.status===429?"Daily limite temporairement les demandes. Réessayez dans quelques instants.":"Daily n’a pas pu préparer la salle. Réessayez dans quelques instants.";
  return json(res,502,{error:"daily_error",message},origin)
 }
}
http.createServer((req,res)=>handle(req,res).catch(()=>json(res,500,{error:"server_error",message:"Erreur interne."},req.headers.origin||""))).listen(PORT,"0.0.0.0",()=>{console.log("RUUNION DIRECT Daily API listening on "+PORT);verifyDaily();});
