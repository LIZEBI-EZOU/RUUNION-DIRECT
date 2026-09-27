import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { SignJWT, importPKCS8 } from "jose";

const PORT=Number(process.env.PORT||10000);
const JAAS_APP_ID=process.env.JAAS_APP_ID||"";
const JAAS_KID=process.env.JAAS_KID||"";
const JAAS_DOMAIN=process.env.JAAS_DOMAIN||"8x8.vc";
const JAAS_PRIVATE_KEY_B64=process.env.JAAS_PRIVATE_KEY_B64||"";
const JAAS_PRIVATE_KEY=process.env.JAAS_PRIVATE_KEY||"";
const ALLOWED_ORIGINS=(process.env.ALLOWED_ORIGINS||"*").split(",").map(s=>s.trim()).filter(Boolean);
const rate=new Map();
let signingKey=null;

setInterval(()=>{const cutoff=Date.now()-60000;for(const [k,v] of rate)if(v.start<cutoff)rate.delete(k)},60000).unref?.();

function cors(origin){
 const allow=ALLOWED_ORIGINS.includes("*")||ALLOWED_ORIGINS.includes(origin)?(ALLOWED_ORIGINS.includes("*")?"*":origin):ALLOWED_ORIGINS[0]||"*";
 return {"Access-Control-Allow-Origin":allow,"Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"};
}
function json(res,status,data,origin){
 for(const [k,v]of Object.entries(cors(origin)))res.setHeader(k,v);
 res.setHeader("Content-Type","application/json; charset=utf-8");res.statusCode=status;res.end(JSON.stringify(data));
}
function clientKey(req){return(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"unknown").toString().split(",")[0].trim()}
function allowed(req){
 const now=Date.now(),key=clientKey(req),entry=rate.get(key);
 if(!entry||now-entry.start>60000){rate.set(key,{start:now,count:1});return true}
 if(entry.count>=30)return false;entry.count++;return true;
}
function safe(s,max=80){return String(s||"").trim().replace(/[^a-zA-Z0-9_-]/g,"-").slice(0,max)}
function getPrivateKey(){
 if(signingKey)return signingKey;
 let pem=JAAS_PRIVATE_KEY;
 if(JAAS_PRIVATE_KEY_B64){try{pem=Buffer.from(JAAS_PRIVATE_KEY_B64,"base64").toString("utf8")}catch{}}
 if(!pem)throw new Error("JAAS_PRIVATE_KEY_B64/JAAS_PRIVATE_KEY manquante");
 signingKey=importPKCS8(pem,"RS256");
 return signingKey;
}
async function createToken(roomName,name,email,moderator){
 const now=Math.floor(Date.now()/1000),userName=safe(name||"Invité",80),userId=crypto.createHash("sha256").update((email||userName||"guest")+"|"+roomName).digest("hex").slice(0,32);
 return new SignJWT({
   aud:"jitsi",iss:"chat",sub:JAAS_APP_ID,room:roomName,
   context:{user:{id:userId,name:userName,email:email||"",moderator:!!moderator},features:{recording:!!moderator,transcription:!!moderator}}
 }).setProtectedHeader({alg:"RS256",kid:JAAS_KID,typ:"JWT"}).setIssuedAt().setNotBefore("0s").setExpirationTime("1h").sign(await getPrivateKey());
}
async function handle(req,res){
 const origin=req.headers.origin||"";
 if(req.method==="OPTIONS"){for(const[k,v]of Object.entries(cors(origin)))res.setHeader(k,v);res.statusCode=204;return res.end()}
 if(req.method==="GET"&&req.url==="/health"){
  const configured=!!(JAAS_APP_ID&&JAAS_KID&&(JAAS_PRIVATE_KEY_B64||JAAS_PRIVATE_KEY));
  return json(res,configured?200:503,{ok:configured,service:"RUUNION DIRECT JaaS API",domain:JAAS_DOMAIN,jaas:configured?"configured":"not_configured"},origin);
 }
 if(req.method==="GET"&&(req.url==="/"||req.url.startsWith("/index.html"))){try{const html=fs.readFileSync(path.join(process.cwd(),"app/src/main/assets/index.html"),"utf8");for(const[k,v]of Object.entries(cors(origin)))res.setHeader(k,v);res.setHeader("Content-Type","text/html; charset=utf-8");res.statusCode=200;return res.end(html)}catch(e){return json(res,500,{error:"web_unavailable"},origin)}}
 if(req.method==="GET"&&req.url==="/manifest.webmanifest"){try{const x=fs.readFileSync(path.join(process.cwd(),"app/src/main/assets/manifest.webmanifest"));for(const[k,v]of Object.entries(cors(origin)))res.setHeader(k,v);res.setHeader("Content-Type","application/manifest+json");res.statusCode=200;return res.end(x)}catch(e){return json(res,404,{error:"not_found"},origin)}}
 if(req.method==="GET"&&req.url==="/sw.js"){try{const x=fs.readFileSync(path.join(process.cwd(),"app/src/main/assets/sw.js"));for(const[k,v]of Object.entries(cors(origin)))res.setHeader(k,v);res.setHeader("Content-Type","application/javascript");res.statusCode=200;return res.end(x)}catch(e){return json(res,404,{error:"not_found"},origin)}}
 if(req.method==="GET"&&req.url==="/ruunion-logo.png"){try{const x=fs.readFileSync(path.join(process.cwd(),"app/src/main/assets/ruunion-logo.png"));for(const[k,v]of Object.entries(cors(origin)))res.setHeader(k,v);res.setHeader("Content-Type","image/png");res.statusCode=200;return res.end(x)}catch(e){return json(res,404,{error:"not_found"},origin)}}
 if(req.method!=="POST"||req.url!=="/meeting")return json(res,404,{error:"not_found"},origin);
 if(!JAAS_APP_ID||!JAAS_KID||!(JAAS_PRIVATE_KEY_B64||JAAS_PRIVATE_KEY))return json(res,503,{error:"not_configured",message:"JaaS n’est pas encore configuré côté serveur."},origin);
 if(!allowed(req))return json(res,429,{error:"rate_limited",message:"Trop de demandes. Réessayez dans une minute."},origin);
 let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>10000)break}
 if(raw.length>10000)return json(res,413,{error:"payload_too_large"},origin);
 let body;try{body=JSON.parse(raw)}catch{return json(res,400,{error:"invalid_json"},origin)}
 const code=safe(body.code,50),requestedRoom=safe(body.roomName,50),room=code||requestedRoom||"meeting-"+Date.now().toString(36),name=safe(body.name,80)||"Invité",email=String(body.email||"").trim().slice(0,160),moderator=body.moderator===true,title=safe(body.title,120)||"RÉUNION DIRECT";
 if(room.includes("/"))return json(res,400,{error:"invalid_room",message:"Nom de salle invalide."},origin);
 try{
  const roomName=JAAS_APP_ID+"/"+room;
  const token=await createToken(roomName,name,email,moderator);
  const url="https://"+JAAS_DOMAIN+"/"+encodeURIComponent(JAAS_APP_ID)+"/"+encodeURIComponent(room);
  return json(res,200,{ok:true,roomName,url,token,code:room,title,expiresAt:Math.floor(Date.now()/1000)+3600},origin);
 }catch(e){
  console.error("JaaS JWT generation failed:",{message:e.message||"",name:e.name||""});
  return json(res,502,{error:"jaas_error",message:"Le serveur n’a pas pu générer le JWT JaaS."},origin);
 }
}
http.createServer((req,res)=>handle(req,res).catch(e=>{console.error("Server error",e);json(res,500,{error:"server_error",message:"Erreur interne."},req.headers.origin||"")})).listen(PORT,"0.0.0.0",()=>console.log("RUUNION DIRECT JaaS API listening on "+PORT));