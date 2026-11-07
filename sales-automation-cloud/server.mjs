
import express from 'express';
import { chromium } from 'playwright';
import pg from 'pg';
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '80kb', strict:true }));
const LOGIN = 'https://elaf.engazcrm.net/login';
const ROOT = 'https://elaf.engazcrm.net';
const WIDTH = 1280, HEIGHT = 800;
const PORT = Number(process.env.PORT || 10000);
const KEY = process.env.HUB_BRIDGE_SECRET || '';
const ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY || '';
const DB = process.env.DATABASE_URL || '';
const ENCRYPT = /^[0-9a-f]{64}$/i.test(ENCRYPTION_KEY) ? Buffer.from(ENCRYPTION_KEY, 'hex') : null;
if (KEY.length < 32 || !ENCRYPT || !DB) {
  console.error('Service configuration missing: HUB_BRIDGE_SECRET, SESSION_ENCRYPTION_KEY or DATABASE_URL');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString:DB, ssl:{rejectUnauthorized:true}, max:3, connectionTimeoutMillis:12000 });
let browser=null, context=null, page=null, started=0, lastUsed=0, verified=false, task=Promise.resolve();
let lastScreenshot=0, cachedScreenshot=null;
const serialize = (operation) => {
 const next = task.then(operation, operation);
 task = next.catch(()=>{});
 return next;
};
function guarded(req,res,next) {
 const header = req.get('x-hub-key') || '';
 const a = Buffer.from(header), b = Buffer.from(KEY);
 if(a.length!==b.length || !timingSafeEqual(a,b))return res.status(401).json({ok:false,code:'AUTH_REQUIRED'});
 res.set('Cache-Control','no-store');
 next();
}
function seal(value) {
 const iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',ENCRYPT,iv);
 const enc=Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value),'utf8')),cipher.final()]);
 const tag=cipher.getAuthTag();
 return Buffer.concat([iv,tag,enc]).toString('base64');
}
function unseal(raw) {
 const buf=Buffer.from(raw,'base64');
 if(buf.length<29)throw Error('INVALID_STATE');
 const iv=buf.subarray(0,12), tag=buf.subarray(12,28), body=buf.subarray(28);
 const decipher=createDecipheriv('aes-256-gcm',ENCRYPT,iv);
 decipher.setAuthTag(tag);
 return JSON.parse(Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8'));
}
async function storedState() {
 const result=await pool.query('SELECT encrypted_state FROM engaz_browser_sessions WHERE id=$1',['primary']);
 if(!result.rows.length)return null;
 return unseal(result.rows[0].encrypted_state);
}
async function storeState(value) {
 await pool.query(
  'INSERT INTO engaz_browser_sessions(id,encrypted_state) VALUES ($1,$2) ON CONFLICT(id) DO UPDATE SET encrypted_state=EXCLUDED.encrypted_state,updated_at=now()',
  ['primary',seal(value)]
 );
}
async function deleteState() {
 await pool.query('DELETE FROM engaz_browser_sessions WHERE id=$1',['primary']);
}
async function release() {
 const current=browser;
 browser=null;context=null;page=null;verified=false;cachedScreenshot=null;
 if(current)await current.close().catch(()=>{});
}
async function initialize(forceFresh=false) {
 if(page && !page.isClosed())return;
 await release();
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']});
 const state=forceFresh ? null : await storedState();
 context=await browser.newContext({
   viewport:{width:WIDTH,height:HEIGHT}, locale:'en-US', timezoneId:'Africa/Cairo',
   ...(state?{storageState:state}:{})
 });
 context.setDefaultTimeout(14000);
 page=await context.newPage();
 page.on('dialog',async d=>{try{await d.dismiss()}catch{}});
 await page.goto(LOGIN,{waitUntil:'domcontentloaded',timeout:30000});
 started=Date.now();lastUsed=Date.now();verified=false;cachedScreenshot=null;
}
async function isLoggedIn() {
 if(!page || page.isClosed())return false;
 const url=page.url();
 try {
   const u=new URL(url);
   if(u.origin!==ROOT) return false;
   if(/\/(?:login|sign-in|signin|reset|forgot|auth)(?:\/|$|\?)/i.test(u.pathname+u.search))return false;
   if(await page.locator('input[type="password"]').count()>0)return false;
   const body = await page.locator('body').textContent({timeout:7000}).catch(()=>null);
   if(!body || body.length<15)return false;
   return true;
 }catch{return false;}
}
async function view() {
 await initialize();
 lastUsed=Date.now();
 if(!cachedScreenshot || Date.now()-lastScreenshot>400) {
  const shot=await page.screenshot({type:'jpeg',quality:63,timeout:15000,animations:'disabled'});
  cachedScreenshot='data:image/jpeg;base64,'+shot.toString('base64');
  lastScreenshot=Date.now();
 }
 return {ok:true,image:cachedScreenshot,url:page.url(),viewport:{width:WIDTH,height:HEIGHT},loggedIn:verified};
}
function clearShot(){cachedScreenshot=null;lastUsed=Date.now();}
function bounds(v,min,max){if(!Number.isFinite(Number(v)))throw Error('INVALID_COORDINATE');return Math.max(min,Math.min(max,Number(v)));}
async function handle(body) {
 const action=body?.action;
 switch(action){
  case 'start':
   await initialize();
   return {ok:true,status:'browser_ready',url:page.url(),message:'المتصفح السحابي جاهز. اضغط على حقول الدخول داخل الصورة ثم اكتب بياناتك.'};
  case 'view':
   return await view();
  case 'click':
   await initialize();
   await page.mouse.click(bounds(body.x,1,WIDTH-1),bounds(body.y,1,HEIGHT-1));
   clearShot();return {ok:true};
  case 'type':{
   await initialize();
   if(typeof body.text!=='string'||body.text.length>250)throw Error('INVALID_TEXT');
   // Intentionally never persist or log sensitive typed content.
   await page.keyboard.type(body.text,{delay:20});
   clearShot();return {ok:true};
  }
  case 'key':{
   await initialize();
   const keys=new Set(['Enter','Tab','Escape','Backspace','Delete','ArrowDown','ArrowUp','ArrowLeft','ArrowRight','ControlOrMeta+A']);
   if(!keys.has(body.key))throw Error('INVALID_KEY');
   await page.keyboard.press(body.key);
   clearShot();return {ok:true};
  }
  case 'scroll':{
   await initialize();
   await page.mouse.wheel(0,bounds(body.delta,-650,650));
   clearShot();return {ok:true};
  }
  case 'finish':{
   await initialize();
   if(!await isLoggedIn())return {ok:false,code:'LOGIN_NOT_CONFIRMED',message:'لم نتأكد من الدخول. افتح صفحة Engaz الداخلية الأول، ثم حاول حفظ الجلسة.'};
   const storageState=await context.storageState({indexedDB:true});
   await storeState(storageState);
   verified=true;
   return {ok:true,status:'saved',message:'تم حفظ حالة الجلسة مشفّرة في قاعدة البيانات المنفصلة.'};
  }
  case 'status':{
   const state=await storedState();
   if(!state)return {ok:true,status:'not_connected'};
   await initialize();
   const result=await isLoggedIn();
   return {ok:true,status:result?'verified':'expired',message:result?'الجلسة المحفوظة صالحة حاليًا':'الجلسة المحفوظة غير صالحة أو انتهت. مطلوب تسجيل دخول مجددًا.'};
  }
  case 'disconnect':
   await deleteState();
   await release();
   return {ok:true,status:'disconnected'};
  default: return {ok:false,code:'UNKNOWN_ACTION',message:'الأمر غير معروف'};
 }
}
app.get('/health',(_req,res)=>res.json({ok:true,service:'elaf-cloud-browser',state:page&&!page.isClosed()?'browser_active':'standby'}));
app.post('/api/engaz',guarded,async(req,res)=>{
 try {
   const result=await serialize(()=>handle(req.body));
   res.status(result.ok?200:409).json(result);
 }catch(e){
   const type=e?.message;
   console.error('operation failed:',typeof type==='string'?type.slice(0,60):'unknown');
   res.status(502).json({ok:false,code:'BROWSER_ERROR',message:'تعذر تنفيذ أمر المتصفح. راجع إعداد الاستضافة أو أعد المحاولة.'});
 }
});
app.use((_req,res)=>res.status(404).json({ok:false,code:'NOT_FOUND'}));
setInterval(()=>{if(page && Date.now()-lastUsed>12*60*1000)serialize(()=>release()).catch(()=>{});},60*1000).unref();
process.on('SIGTERM',()=>{release().finally(()=>pool.end().finally(()=>process.exit(0)))});
app.listen(PORT,'0.0.0.0',()=>console.log('ELAF cloud browser listening on port',PORT));
