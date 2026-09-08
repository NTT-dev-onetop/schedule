import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore,doc,getDoc,setDoc,updateDoc,addDoc,collection,query,orderBy,getDocs,runTransaction,serverTimestamp,arrayUnion,deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),provider=new GoogleAuthProvider();
const DAYS=["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7"];
const PERIODS=[
 ["Sáng - Tiết 1","06:55","07:40","Sáng","1"],["Sáng - Tiết 2","07:45","08:30","Sáng","2"],["Sáng - Tiết 3","08:55","09:40","Sáng","3"],["Sáng - Tiết 4","09:45","10:30","Sáng","4"],["Sáng - Tiết 5","10:35","11:20","Sáng","5"],
 ["Chiều - Tiết 1","13:40","14:25","Chiều","1"],["Chiều - Tiết 2","14:25","15:10","Chiều","2"],["Chiều - Tiết 3","15:15","16:00","Chiều","3"],["Chiều - Tiết 4","16:00","16:45","Chiều","4"]
];
const SUBJECTS=["Toán","Ngữ văn","Tiếng Anh","Vật lý","Hóa học","Sinh học","Lịch sử","Địa lý","GDCD","Tin học","Công nghệ","Thể dục","GDQP","Âm nhạc","Mỹ thuật","Khác"];
let user=null,profile=null,weekStart=monday(new Date()),tasks=[],users=[],view="board",period="current",searchTimer=null,currentSchedule={},taskSchedule={};

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const iso=d=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`};
function localDate(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function monday(d){const x=new Date(d);x.setHours(0,0,0,0);const n=x.getDay();x.setDate(x.getDate()+(n===0?-6:1-n));return x}
function escape(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function showAuthError(msg){const e=$("#authErr");if(e){e.textContent=msg;e.classList.remove("hidden")}}
function clearAuthError(){const e=$("#authErr");if(e){e.textContent="";e.classList.add("hidden")}}
function toast(msg){const e=$("#toast");e.textContent=msg;e.classList.add("show");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("show"),2600)}
function errorMessage(e){const c=e?.code||"";const map={"auth/popup-closed-by-user":"Bạn đã đóng cửa sổ đăng nhập.","auth/popup-blocked":"Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép popup rồi thử lại.","auth/cancelled-popup-request":"Yêu cầu đăng nhập đã bị hủy.","auth/unauthorized-domain":"Tên miền hiện tại chưa được thêm vào Authorized domains của Firebase.","auth/operation-not-allowed":"Đăng nhập Google chưa được bật trong Firebase Authentication.","auth/network-request-failed":"Không thể kết nối Firebase. Kiểm tra mạng rồi thử lại.","permission-denied":"Bạn không có quyền thực hiện thao tác này."};return map[c]||e?.message||"Có lỗi xảy ra. Vui lòng thử lại."}
function initials(n="HS"){return n.trim().split(/\s+/).slice(-2).map(x=>x[0]).join("").toUpperCase()||"HS"}
function periodByKey(key){return PERIODS.find(p=>p[0]===key)}
function dayFromDate(date){const n=localDate(date).getDay();return n===0?"":DAYS[n-1]}
function weekKeyForDate(date){return iso(monday(localDate(date)))}

function subjectOptions(selected="",subjects=SUBJECTS){
 const list=[...new Set(subjects.filter(Boolean))];
 if(selected&&!list.includes(selected))list.unshift(selected);
 return list.map(s=>`<option value="${escape(s)}" ${s===selected?"selected":""}>${escape(s)}</option>`).join("");
}

function renderSchedule(){
 $("#weekText").textContent=`${weekStart.toLocaleDateString("vi-VN")} – ${new Date(weekStart.getTime()+6*86400000).toLocaleDateString("vi-VN")}`;
 const head=`<thead><tr><th rowspan="2" class="day-col">Thứ</th><th colspan="5" class="session morning">☀️ Sáng</th><th colspan="4" class="session afternoon">🌙 Chiều</th></tr><tr>${PERIODS.map(p=>`<th class="period-head ${p[3]==="Sáng"?"morning":"afternoon"}">Tiết ${p[4]}<small>${p[1]}–${p[2]}</small></th>`).join("")}</tr></thead>`;
 const body=`<tbody>${DAYS.map((d,di)=>`<tr><th class="day-name">${d}<small>${new Date(weekStart.getTime()+di*86400000).toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})}</small></th>${PERIODS.map(p=>`<td><select class="schedule-input" data-day="${d}" data-period="${p[0]}" aria-label="${d} ${p[0]}"><option value="">— Chọn môn —</option>${subjectOptions()}</select></td>`).join("")}</tr>`).join("")}</tbody>`;
 $("#scheduleTable").innerHTML=head+body;
 loadSchedule().catch(e=>toast(errorMessage(e)));
}
async function loadSchedule(){
 const s=await getDoc(doc(db,"schedules",`${user.uid}_${iso(weekStart)}`));currentSchedule=s.exists()?(s.data().schedule||{}):{};
 $$(".schedule-input").forEach(e=>e.value=currentSchedule[e.dataset.day]?.[e.dataset.period]||"");
}
async function saveSchedule(){
 const schedule={};
 DAYS.forEach(d=>{schedule[d]={};PERIODS.forEach(p=>{schedule[d][p[0]]=$( `.schedule-input[data-day="${d}"][data-period="${p[0]}"]`)?.value||""})});
 await setDoc(doc(db,"schedules",`${user.uid}_${iso(weekStart)}`),{userId:user.uid,weekStart:iso(weekStart),schedule,updatedAt:serverTimestamp()},{merge:true});
 currentSchedule=schedule;
 await syncTaskDropdown();
 toast("Đã lưu thời khóa biểu và cập nhật danh sách môn cho Nhiệm vụ");
}

function scheduleSubjectsForDate(date){
 const day=dayFromDate(date),row=currentSchedule[day]||{};
 const subjects=PERIODS.map(p=>row[p[0]]).filter(Boolean);
 return [...new Set(subjects)];
}
async function loadScheduleForDate(date){
 const key=weekKeyForDate(date);
 if(key===iso(weekStart))return currentSchedule;
 const s=await getDoc(doc(db,"schedules",`${user.uid}_${key}`));
 return s.exists()?(s.data().schedule||{}):{};
}
async function syncTaskDropdown(){
 const date=$("#taskDate").value||iso(new Date());
 const day=dayFromDate(date);
 const schedule=await loadScheduleForDate(date);
 const row=schedule[day]||{};
 const subjects=[...new Set(PERIODS.map(p=>row[p[0]]).filter(Boolean))];
 const previous=$("#taskSubject").value;
 const list=subjects.length?subjects:SUBJECTS;
 $("#taskSubject").innerHTML=subjectOptions(previous,list);
 if(!$("#taskSubject").value)$("#taskSubject").value=list[0]||"";
 syncTaskPeriods(schedule);
}
function syncTaskPeriods(scheduleOverride=null){
 const date=$("#taskDate").value||iso(new Date()),subject=$("#taskSubject").value,day=dayFromDate(date);
 const schedule=scheduleOverride||currentSchedule,row=schedule[day]||{};
 const matches=PERIODS.filter(p=>row[p[0]]===subject);
 const list=matches.length?matches:PERIODS;
 const previous=$("#taskPeriod").value;
 $("#taskPeriod").innerHTML=list.map(p=>`<option value="${escape(p[0])}" ${p[0]===previous?"selected":""}>${p[3]} • Tiết ${p[4]} (${p[1]}–${p[2]})</option>`).join("");
 if(!$("#taskPeriod").value&&list[0])$("#taskPeriod").value=list[0][0];
}

function fillSubjects(){
 $("#subjectFilter").innerHTML=`<option value="all">Tất cả môn</option>`+SUBJECTS.map(s=>`<option value="${escape(s)}">${escape(s)}</option>`).join("");
 syncTaskDropdown().catch(()=>{});
}
async function loadUsers(){
 try{
  const snap=await getDocs(query(collection(db,"users"),orderBy("displayName")));
  users=snap.docs.map(d=>({id:d.id,...d.data()}));
  $("#userFilter").innerHTML=`<option value="all">Tất cả người dùng</option>`+users.map(u=>`<option value="${escape(u.uid)}">${escape(u.displayName||u.email||"Học sinh")}</option>`).join("");
 }catch(e){console.warn(e);}
}
async function loadTasks(){
 const snap=await getDocs(query(collection(db,"tasks"),orderBy("date","asc"),orderBy("period","asc")));
 tasks=snap.docs.map(d=>({id:d.id,...d.data()}));renderTasks();
}
function filteredTasks(){
 const today=iso(new Date()),uf=$("#userFilter").value,sf=$("#subjectFilter").value,q=$("#search").value.trim().toLowerCase();
 return tasks.filter(t=>(period==="current"?t.date>=today:t.date<today)&&(uf==="all"||t.createdBy===uf)&&(sf==="all"||t.subject===sf)&&(!q||`${t.subject} ${t.taskContent} ${t.description||""}`.toLowerCase().includes(q))).sort((a,b)=>a.date.localeCompare(b.date)||PERIODS.findIndex(p=>p[0]===a.period)-PERIODS.findIndex(p=>p[0]===b.period));
}
function renderTasks(){
 const list=filteredTasks();
 if(!list.length){$("#taskArea").innerHTML=`<div class="empty"><i class="fa-regular fa-circle-check"></i><strong>Chưa có nhiệm vụ</strong><span>Hãy tạo nhiệm vụ đầu tiên hoặc đổi bộ lọc.</span></div>`;return}
 if(view==="list"){renderList(list);return}
 const groups={};list.forEach(t=>(groups[t.date]??=[]).push(t));
 $("#taskArea").innerHTML=Object.entries(groups).map(([date,arr])=>`<div class="day"><div class="day-head"><div><strong>📌 ${localDate(date).toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"})}</strong><small>${arr.length} nhiệm vụ</small></div><span>${arr.filter(t=>(t.completedBy||[]).includes(user.uid)).length}/${arr.length} hoàn thành</span></div>${arr.map(taskHtml).join("")}</div>`).join("");
}
function renderList(list){$("#taskArea").innerHTML=`<div class="day">${list.map(taskHtml).join("")}</div>`}
function taskHtml(t){
 const mine=t.createdBy===user.uid,done=(t.completedBy||[]).includes(user.uid);
 return `<article class="task"><div class="task-time"><b>${escape((t.period||"").replace("Sáng - ","Sáng • ").replace("Chiều - ","Chiều • "))}</b><small>${escape(t.startTime||"")}–${escape(t.endTime||"")}</small></div><div class="subject-pill">${escape(t.subject)}</div><div class="task-main"><div class="task-title ${done?"completed":""}">${escape(t.taskContent)}</div><div class="author">${Number(t.points||0)} điểm${t.description?` · ${escape(t.description)}`:""}</div></div><button class="complete" data-complete="${t.id}" ${done?"disabled":""}>${done?"✓ Đã nhận":"Hoàn thành"}</button>${mine?`<button class="icon delete" title="Xóa" data-delete="${t.id}"><i class="fa-solid fa-trash"></i></button>`:""}</article>`;
}
async function createTask(){
 const date=$("#taskDate").value,p=$("#taskPeriod").value,subject=$("#taskSubject").value,deadline=$("#deadline").value;
 const row=periodByKey(p);if(!date||!subject||!row)throw new Error("Vui lòng chọn đủ ngày, môn và tiết.");
 await addDoc(collection(db,"tasks"),{createdBy:user.uid,authorName:profile.displayName||"Học sinh",subject,taskContent:$("#taskContent").value.trim(),date,dayOfWeek:dayFromDate(date),period:p,startTime:row[1],endTime:row[2],deadline:new Date(deadline).toISOString(),description:$("#taskDescription").value.trim(),points:Number($("#taskPoints").value),status:"pending",completedBy:[],completedAt:null,createdAt:serverTimestamp()});
 $("#taskDialog").close();$("#taskForm").reset();setTaskDefaults();await loadTasks();toast("Đã tạo nhiệm vụ");
}
async function completeTask(id){
 await runTransaction(db,async tx=>{
  const ref=doc(db,"tasks",id),snap=await tx.get(ref);if(!snap.exists())throw new Error("not-found");
  const t=snap.data(),completed=t.completedBy||[];if(completed.includes(user.uid))return;
  const now=new Date(),deadline=new Date(t.deadline),onTime=now<=deadline;
  tx.update(ref,{completedBy:arrayUnion(user.uid),completedAt:serverTimestamp(),status:"completed"});
  if(onTime){const uref=doc(db,"users",user.uid),us=await tx.get(uref),u=us.data()||{};tx.update(uref,{points:Number(u.points||0)+Number(t.points||0),weeklyPoints:Number(u.weeklyPoints||0)+Number(t.points||0),tasksCompleted:Number(u.tasksCompleted||0)+1})}
 });
 await loadProfile();await loadTasks();toast("Đã hoàn thành nhiệm vụ");
}
async function deleteTask(id){if(!confirm("Xóa nhiệm vụ này?"))return;await deleteDoc(doc(db,"tasks",id));await loadTasks();toast("Đã xóa nhiệm vụ")}

async function loadProfile(){
 const s=await getDoc(doc(db,"users",user.uid));profile=s.data()||{displayName:user.email?.split("@")[0]||"Học sinh",className:"",points:0,weeklyPoints:0,tasksCompleted:0};
 $("#headerName").textContent=profile.displayName||"Học sinh";$("#profileName").textContent=profile.displayName||"Học sinh";$("#profileEmail").textContent=profile.email||user.email||"";$("#avatar").textContent=initials(profile.displayName||"HS");
 $("#profileDisplay").value=profile.displayName||"";$("#profileClass").value=profile.className||"";$("#points").textContent=profile.points||0;$("#weekly").textContent=profile.weeklyPoints||0;$("#completed").textContent=profile.tasksCompleted||0;
}
async function saveProfile(){const name=$("#profileDisplay").value.trim(),cls=$("#profileClass").value.trim();await updateDoc(doc(db,"users",user.uid),{displayName:name,className:cls});await loadProfile();await loadUsers();toast("Đã cập nhật hồ sơ")}
async function leaderboard(){const snap=await getDocs(query(collection(db,"users"),orderBy("weeklyPoints","desc")));const top=snap.docs.map(d=>d.data()).slice(0,10);$("#ranking").innerHTML=top.length?top.map((u,i)=>`<div class="rank"><strong>#${i+1}</strong><span>${escape(u.displayName||"Học sinh")} <small class="muted">${escape(u.className||"")}</small></span><span>${u.tasksCompleted||0} nhiệm vụ</span><strong>${u.weeklyPoints||0} điểm</strong></div>`).join(""):`<div class="empty">Chưa có dữ liệu xếp hạng.</div>`}
function setTaskDefaults(){const d=iso(new Date());$("#taskDate").value=d;$("#deadline").value=`${d}T23:59`;syncTaskDropdown().catch(()=>{});$("#taskPoints").value=10}
function switchTab(name){$$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));$$('.tab').forEach(s=>s.classList.toggle('active',s.id===name+'Tab'));if(name==='leaderboard')leaderboard().catch(e=>toast(errorMessage(e)))}

$("#googleLogin").onclick=async()=>{clearAuthError();const btn=$("#googleLogin");btn.disabled=true;btn.innerHTML='<i class="fa-brands fa-google"></i> Đang đăng nhập...';try{await signInWithPopup(auth,provider)}catch(x){console.error("Firebase Google login error:",x);showAuthError(errorMessage(x))}finally{btn.disabled=false;btn.innerHTML='<i class="fa-brands fa-google"></i> Đăng nhập bằng Google'}};
$("#logout").onclick=()=>signOut(auth);
$$('.nav').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
$("#prevWeek").onclick=()=>{weekStart.setDate(weekStart.getDate()-7);renderSchedule()};
$("#nextWeek").onclick=()=>{weekStart.setDate(weekStart.getDate()+7);renderSchedule()};
$("#thisWeek").onclick=()=>{weekStart=monday(new Date());renderSchedule()};
$("#saveSchedule").onclick=()=>saveSchedule().catch(e=>toast(errorMessage(e)));
$("#newTask").onclick=()=>{$("#taskDialog").showModal();setTaskDefaults()};
$("#closeDialog").onclick=()=>$("#taskDialog").close();$("#cancelDialog").onclick=()=>$("#taskDialog").close();
$("#taskForm").onsubmit=e=>{e.preventDefault();createTask().catch(x=>toast(errorMessage(x)))};
$("#taskDate").onchange=()=>syncTaskDropdown().catch(e=>toast(errorMessage(e)));
$("#taskSubject").onchange=()=>syncTaskPeriods(taskSchedule);
["userFilter","subjectFilter"].forEach(id=>$("#"+id).onchange=renderTasks);
$("#search").oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(renderTasks,180)};
$$('.seg button').forEach(b=>b.onclick=()=>{$$('.seg button').forEach(x=>x.classList.toggle('active',x===b));view=b.dataset.view;renderTasks()});
$$('.subtabs button').forEach(b=>b.onclick=()=>{$$('.subtabs button').forEach(x=>x.classList.toggle('active',x===b));period=b.dataset.period;renderTasks()});
$("#taskArea").onclick=e=>{const c=e.target.closest('[data-complete]'),d=e.target.closest('[data-delete]');if(c&&!c.disabled)completeTask(c.dataset.complete).catch(x=>toast(errorMessage(x)));if(d)deleteTask(d.dataset.delete).catch(x=>toast(errorMessage(x)))};
$("#profileForm").onsubmit=e=>{e.preventDefault();saveProfile().catch(x=>toast(errorMessage(x)))};

onAuthStateChanged(auth,async u=>{
 user=u;
 if(u){
  clearAuthError();$("#auth").classList.add('hidden');$("#app").classList.remove('hidden');$("#headerName").textContent=u.displayName||u.email||"";
  try{const userRef=doc(db,"users",u.uid),existing=await getDoc(userRef);if(!existing.exists())await setDoc(userRef,{uid:u.uid,email:u.email||"",displayName:u.displayName||u.email?.split('@')[0]||"Học sinh",className:"",points:0,weeklyPoints:0,tasksCompleted:0,createdAt:serverTimestamp()});await loadProfile();fillSubjects();renderSchedule();await loadUsers();await loadTasks()}catch(e){console.error("Firebase init error:",e);toast(errorMessage(e))}
 }else{$("#auth").classList.remove('hidden');$("#app").classList.add('hidden');clearAuthError()}
});
