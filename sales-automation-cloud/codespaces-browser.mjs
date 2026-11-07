import express from "express";
import { chromium } from "playwright";
import { createCipheriv, createDecipheriv, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, mkdir, unlink, chmod } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";

const ROOT = resolve(process.cwd());
const app = express();
app.disable("x-powered-by");
app.use(express.json({limit:"2kb", strict:true}));
const HOST="https://elaf.engazcrm.net";
const LOGIN=HOST+"/login";
const WIDTH=1280, HEIGHT=800;
const PORT=Number(process.env.PORT||3000);
const dir=join(homedir(),".local","share","elaf-sales-hub");
const keyFile=join(dir,"session.key");
const sessionFile=join(dir,"engaz.state.enc");
const pinFile=join(dir,"one-time-code.txt");
let key, authKey, browser, context, page, busy=Promise.resolve();
let pairingCode="", pairingUntil=0, attempts=0, currentVerified=false;
let lastScreenshot=0, screenshotCache=null;

function json(res,code,value) {return res.status(code).set("Cache-Control","no-store").json(value);}
function serial(fn) {
 const next=busy.then(fn,fn);
 busy=next.catch(()=>{});
 return next;
}
function safeEqual(a,b) {
 const x=Buffer.from(String(a||"")), y=Buffer.from(String(b||""));
 return x.length===y.length && timingSafeEqual(x,y);
}
async function setup() {
 await mkdir(dir,{recursive:true,mode:0o700});
 try {key=await readFile(keyFile);}catch {
  key=randomBytes(32);
  await writeFile(keyFile,key,{mode:0o600,flag:"wx"});
 }
 if(key.length!==32) throw Error("SECURITY_KEY_CORRUPT");
 const authFile=join(dir,"auth.key");
 try {authKey=await readFile(authFile);}catch {
  authKey=randomBytes(32);
  await writeFile(authFile,authKey,{mode:0o600,flag:"wx"});
 }
 if(authKey.length!==32)throw Error("AUTH_KEY_CORRUPT");
 pairingCode=String(randomInt(10000000,100000000));
 pairingUntil=Date.now()+30*60*1000;
 await writeFile(pinFile,pairingCode+"\n",{mode:0o600});
 console.log("ELAF Browser Login: http://localhost:"+PORT);
 console.log("Your one-time PIN is in the Codespace terminal: cat ~/.local/share/elaf-sales-hub/one-time-code.txt");
}
const authCookie = () => "hub_token="+authKey.toString("hex")+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800";
function isAuthed(req) {
 const raw=(req.headers.cookie||"").split(";").map(v=>v.trim()).find(v=>v.startsWith("hub_token="));
 return raw && safeEqual(raw.slice(10),authKey.toString("hex"));
}
function guarded(req,res,next) {
 if(!isAuthed(req))return json(res,401,{ok:false,code:"PIN_REQUIRED",message:"يجب إدخال كود الحماية أولًا"});
 return next();
}
function sameOrigin(req) {
 const origin=req.get("origin"); if(!origin)return false;
 try{
  const target=new URL(origin);
  const hosts=[req.get("x-forwarded-host"),req.get("host")].filter(Boolean);
  if(process.env.CODESPACE_NAME)hosts.push(process.env.CODESPACE_NAME+"-3000.app.github.dev");
  return target.protocol==="https:"&&hosts.includes(target.host);
 }catch{return false;}
}
app.use((req,res,next)=>{
 res.set("X-Frame-Options","DENY");
 res.set("X-Content-Type-Options","nosniff");
 res.set("Referrer-Policy","no-referrer");
 res.set("Cache-Control","no-store");
 res.set("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
 next();
});
app.get("/",(_req,res)=>res.sendFile(join(ROOT,"codespaces-ui.html")));
app.get("/ui.js",(_req,res)=>res.type("text/javascript").sendFile(join(ROOT,"codespaces-ui.js")));
app.get("/api/me",(req,res)=>json(res,200,{ok:true,authenticated:!!isAuthed(req),codespace:!!process.env.CODESPACE_NAME}));
app.post("/api/pair",async(req,res)=>{
 if(!sameOrigin(req))return json(res,403,{ok:false,message:"طلب غير مسموح"});
 if(attempts>=12)return json(res,429,{ok:false,message:"محاولات كثيرة، أعد تشغيل Codespace لتوليد كود جديد"});
 if(Date.now()>pairingUntil)return json(res,410,{ok:false,message:"انتهت صلاحية الكود. أعد تشغيل Codespace"});
 attempts++;
 if(!safeEqual(req.body?.pin,pairingCode))return json(res,401,{ok:false,message:"كود الدخول غير صحيح"});
 attempts=0;
 res.set("Set-Cookie",authCookie());
 return json(res,200,{ok:true});
});
function encrypt(content) {
 const iv=randomBytes(12), cipher=createCipheriv("aes-256-gcm",key,iv);
 const body=Buffer.concat([cipher.update(JSON.stringify(content),"utf8"),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),body]).toString("base64");
}
function decrypt(txt) {
 const buf=Buffer.from(txt,"base64");
 if(buf.length<29)throw Error("STATE_CORRUPT");
 const dec=createDecipheriv("aes-256-gcm",key,buf.subarray(0,12));
 dec.setAuthTag(buf.subarray(12,28));
 return JSON.parse(Buffer.concat([dec.update(buf.subarray(28)),dec.final()]).toString("utf8"));
}

async function requestImmediateVerification() {
 return new Promise((resolve,reject)=>{
  const child=spawn("gh",[
   "workflow","run","elaf-sales-session-check.yml",
   "--repo","SayedElsenosy/Real-Estate-Workspace","--ref","main"
  ],{env:{...process.env,GH_PROMPT_DISABLED:"1"},stdio:["ignore","ignore","ignore"]});
  child.on("error",()=>reject(Error("GH_WORKFLOW_REQUEST_FAILED")));
  child.on("close",code=>code===0?resolve():reject(Error("GH_WORKFLOW_REQUEST_FAILED")));
 });
}

async function setActionSecret(name,value) {
 if(!/^[A-Z0-9_]+$/.test(name)) throw Error("INVALID_SECRET_NAME");
 return new Promise((resolve,reject)=>{
  const args=["secret","set",name,"--repo","SayedElsenosy/Real-Estate-Workspace","--app","actions"];
  const child=spawn("gh",args,{env:{...process.env,GH_PROMPT_DISABLED:"1"},stdio:["pipe","ignore","pipe"]});
  let rejected=false;
  child.on("error",()=>{if(!rejected){rejected=true;reject(Error("GH_CLI_UNAVAILABLE"));}});
  child.on("close",code=>{
   if(rejected)return;
   rejected=true;
   if(code===0)resolve();else reject(Error("GITHUB_SECRET_WRITE_FORBIDDEN"));
  });
  // GitHub CLI encrypts repository secrets locally before sending them over HTTPS.
  // Do not pass secret values as command-line args or write them to logs.
  child.stdin.on("error",()=>{});
  child.stdin.end(value+"\n");
 });
}

async function savedState() {
 try {return decrypt(await readFile(sessionFile,"utf8"));}catch(e){
  if(e.code==="ENOENT")return null;
  throw e;
 }
}
async function closeBrowser() {
 try{await browser?.close();}catch{}
 page=undefined;context=undefined;browser=undefined;currentVerified=false;screenshotCache=null;
}
async function start(fresh=false) {
 if(page && !page.isClosed() && !fresh)return;
 await closeBrowser();
 const state=fresh?null:await savedState();
 browser=await chromium.launch({headless:true,args:["--disable-dev-shm-usage","--no-sandbox"]});
 context=await browser.newContext({viewport:{width:WIDTH,height:HEIGHT},locale:"en-US",timezoneId:"Africa/Cairo",...(state?{storageState:state}:{})});
 context.setDefaultTimeout(15000);
 page=await context.newPage();
 await page.goto(LOGIN,{waitUntil:"domcontentloaded",timeout:35000});
 await page.waitForTimeout(800);
 currentVerified=false;screenshotCache=null;
}
async function checkSession() {
 if(!page||page.isClosed())return false;
 const u=new URL(page.url());
 if(u.origin!==HOST || /\/(login|signin|forgot|reset|auth)(\/|$)/i.test(u.pathname))return false;
 if(await page.locator('input[type="password"]').count())return false;
 const text=await page.locator("body").textContent({timeout:5000}).catch(()=>"");
 // Engaz's ELAF dashboard normally displays both Leads and Dashboard.
 return /Leads/i.test(text) && /Dashboard/i.test(text);
}
async function frame() {
 if(!page || page.isClosed())await start();
 if(!screenshotCache || Date.now()-lastScreenshot>800) {
   const image=await page.screenshot({type:"jpeg",quality:62,timeout:18000});
   screenshotCache="data:image/jpeg;base64,"+image.toString("base64");
   lastScreenshot=Date.now();
 }
 return {ok:true,image:screenshotCache,viewport:{width:WIDTH,height:HEIGHT},currentPage:page.url(),saved:(await savedState())!==null};
}
function clearFrame(){screenshotCache=null;}
const clamp=(n,min,max)=>Number.isFinite(Number(n))?Math.min(Math.max(Number(n),min),max):NaN;
const allowedKeys=new Set(["Enter","Tab","Escape","Backspace","Delete","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","ControlOrMeta+A"]);
async function operate(body) {
 const action=body?.action;
 if(action==="start"){await start();return await frame();}
 if(action==="fresh"){await start(true);return await frame();}
 if(action==="view"){return await frame();}
 if(action==="click"){
  await start();
  const x=clamp(body.x,0,WIDTH-1),y=clamp(body.y,0,HEIGHT-1);
  if(!Number.isFinite(x)||!Number.isFinite(y))return {ok:false,message:"الإحداثيات غير صحيحة"};
  await page.mouse.click(x,y);clearFrame();await page.waitForTimeout(200);return await frame();
 }
 if(action==="type"){
  await start();
  if(typeof body.text!=="string"||body.text.length>250)return {ok:false,message:"النص طويل جدًا"};
  // Passwords go straight to the remote browser; never log, retain, or save this input.
  await page.keyboard.insertText(body.text);clearFrame();
  return await frame();
 }
 if(action==="key"){
  await start();
  if(!allowedKeys.has(body.key))return {ok:false,message:"مفتاح غير متاح"};
  await page.keyboard.press(body.key);clearFrame();await page.waitForTimeout(450);return await frame();
 }
 if(action==="scroll"){
  await start();
  const d=clamp(body.delta,-700,700);
  if(!Number.isFinite(d))return {ok:false,message:"حركة غير صحيحة"};
  await page.mouse.wheel(0,d);clearFrame();await page.waitForTimeout(100);return await frame();
 }
 if(action==="save"){
  await start();
  if(!(await checkSession()))return {ok:false,message:"لم يتم التحقق من تسجيل الدخول. يجب أن تظهر صفحة Engaz الداخلية بها Leads وDashboard."};
  // Only save Playwright storage state. Plaintext login credentials are never stored by the app.
  const state=await context.storageState({indexedDB:true});
  await writeFile(sessionFile,encrypt(state),{mode:0o600});
  await chmod(sessionFile,0o600);
  currentVerified=true;
  let synced=false,checkRequested=false;
  try {
   const encrypted=(await readFile(sessionFile,"utf8")).trim();
   if(Buffer.byteLength(encrypted,"utf8")>47000)throw Error("SECRET_TOO_BIG");
   await setActionSecret("ELAF_SESSION_KEY",key.toString("hex"));
   await setActionSecret("ELAF_ENGAZ_STATE",encrypted);
   synced=true;
   try {await requestImmediateVerification();checkRequested=true;}catch {}
  }catch {
   // A missing GitHub permission must not result in false claims of cloud sync.
   console.error("GitHub Actions encrypted session sync requires permission");
  }
  return {ok:true,saved:true,synced,checkRequested,message:synced
   ?"تم حفظ جلسة Engaz مشفّرة، ونقل بياناتها المشفّرة إلى أسرار GitHub Actions للمهام المجدولة."
   :"تم حفظ الجلسة مشفّرة داخل Codespace، لكن GitHub رفض نقلها لأسرار Actions. الجدولة غير مفعّلة للجلسة بعد."};
 }
 if(action==="status"){
  const exists=!!(await savedState());
  if(!exists)return {ok:true,status:"not_saved"};
  await start();
  currentVerified=await checkSession();
  return {ok:true,status:currentVerified?"verified":"expired",message:currentVerified?"الجلسة المحفوظة صالحة الآن":"الجلسة موجودة لكنها لم تجتز تحقق الدخول الحالي."};
 }
 if(action==="disconnect"){
  await closeBrowser();
  await unlink(sessionFile).catch(e=>{if(e.code!=="ENOENT")throw e;});
  return {ok:true,status:"disconnected",message:"تم حذف الجلسة المحفوظة."};
 }
 return {ok:false,message:"أمر غير معروف"};
}
app.post("/api/browser",guarded,(req,res)=>{
 if(!sameOrigin(req))return json(res,403,{ok:false,message:"طلب غير مسموح"});
 serial(()=>operate(req.body)).then(
  result=>json(res,result.ok?200:409,result),
  _error=>{
   console.error("Remote browser operation failed (details redacted)");
   return json(res,502,{ok:false,message:"تعذر إكمال العملية. يمكن إعادة فتح المتصفح أو تحديث الصفحة."});
  }
 );
});
process.on("SIGTERM",()=>closeBrowser().finally(()=>process.exit(0)));
await setup();
app.listen(PORT,"0.0.0.0",()=>console.log("ELAF Cloud Login Ready on",PORT));
