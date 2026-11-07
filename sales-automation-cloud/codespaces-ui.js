"use strict";
const $=id=>document.getElementById(id);
let running=false;
function status(text,kind="") {
 const el=$("status");
 el.textContent=text;
 el.className="status"+(kind?" "+kind:"");
}
function busy(v){
 running=v;
 $("busy").style.display=v?"block":"none";
 for(const btn of document.querySelectorAll("#app button"))btn.disabled=v;
}
function present(d){
 if(d.image){
  $("shot").src=d.image;
  $("shot").hidden=false;
  $("empty").hidden=true;
 }
 if(d.currentPage)$("url").textContent=d.currentPage;
}
async function post(url,body){
 const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),credentials:"same-origin",cache:"no-store"});
 const d=await res.json();
 if(!res.ok||d.ok===false)throw Error(d.message||"تعذر تنفيذ الطلب");
 return d;
}
async function operate(action,payload={}){
 if(running)return;
 busy(true);
 try{
  const d=await post("/api/browser",{action,...payload});
  present(d);
  if(d.message)status(d.message,d.saved?"good":"");
  else if(action==="start"||action==="view"||action==="fresh")status("المتصفح السحابي جاهز. اضغط داخل الصورة لتحديد مكان الكتابة.","good");
  return d;
 }catch(e){status(e.message,"bad");return null;}
 finally{busy(false);}
}
async function bootstrap(){
 try{
  const response=await fetch("/api/me",{cache:"no-store"});
  const d=await response.json();
  if(d.authenticated){
   $("app").style.display="block";$("auth").style.display="none";
   await operate("view");
  }else{$("app").style.display="none";$("auth").style.display="block";}
 }catch(e){$("auth").style.display="block";$("authmsg").textContent="تعذر الوصول لخدمة المتصفح السحابي.";}
}
$("unlock").addEventListener("click",async()=>{
 const btn=$("unlock");btn.disabled=true;
 try{
  await post("/api/pair",{pin:$("pin").value.trim()});
  $("pin").value="";
  await bootstrap();
 }catch(e){$("authmsg").textContent=e.message;}
 finally{btn.disabled=false;}
});
$("pin").addEventListener("keydown",e=>{if(e.key==="Enter")$("unlock").click();});
$("start").addEventListener("click",()=>operate("start"));
$("refresh").addEventListener("click",()=>operate("view"));
$("reload").addEventListener("click",()=>operate("view"));
$("fresh").addEventListener("click",()=>{if(confirm("تبدأ دخول جديد؟ الجلسة المحفوظة القديمة مش هتتحذف إلا لما تحفظ جلسة جديدة."))operate("fresh");});
$("check").addEventListener("click",async()=>{
 const d=await operate("status");
 if(d)status(d.message||(d.status==="not_saved"?"لم يتم حفظ جلسة حتى الآن.":"الحالة: "+d.status),d.status==="verified"?"good":"bad");
});
$("save").addEventListener("click",()=>operate("save"));
$("hide").addEventListener("change",()=>$("typing").type=$("hide").checked?"password":"text");
$("typing").type="password";
$("typeForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const text=$("typing").value;
 $("typing").value="";
 if(!text)return;
 await operate("type",{text});
});
document.querySelectorAll("[data-key]").forEach(b=>b.addEventListener("click",()=>operate("key",{key:b.dataset.key})));
$("up").addEventListener("click",()=>operate("scroll",{delta:-520}));
$("down").addEventListener("click",()=>operate("scroll",{delta:520}));
$("shot").addEventListener("click",e=>{
 const rect=e.currentTarget.getBoundingClientRect();
 const x=Math.round((e.clientX-rect.left)*1280/rect.width);
 const y=Math.round((e.clientY-rect.top)*800/rect.height);
 operate("click",{x,y});
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!running)operate("key",{key:"Escape"});});
bootstrap();