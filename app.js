import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore,doc,getDoc,setDoc,updateDoc,addDoc,collection,query,orderBy,getDocs,runTransaction,serverTimestamp,arrayUnion } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const DAYS=["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7"];
const PERIODS=[
["Sáng - Tiết 1","06:55","07:40"],["Sáng - Tiết 2","07:45","08:30"],["Sáng - Tiết 3","08:55","09:40"],["Sáng - Tiết 4","09:45","10:30"],["Sáng - Tiết 5","10:35","11:20"],
["Chiều - Tiết 1","13:40","14:25"],["Chiều - Tiết 2","14:25","15:10"],["Chiều - Tiết 3","15:15","16:00"],["Chiều - Tiết 4","16:00","16:45"]];
const SUBJECTS=["Toán","Ngữ văn","Tiếng Anh","Vật lý","Hóa học","Sinh học","Lịch sử","Địa lý","GDCD","Tin học","Công nghệ","Thể dục","GDQP","Âm nhạc","Mỹ thuật","Khác"];
let user=null,profile=null,weekStart=monday(new Date()),tasks=[],users=[],view="board",period="current",searchTimer=null;

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const iso=d=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`};
function localDate(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function monday(d){const x=new Date(d);x.setHours(0,0,0,0);const n=x.getDay();x.setDate(x.getDate()+(n===0?-6:1-n));return x}
function escape(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function toast(msg){const e=$("#toast");e.textContent=msg;e.classList.add("show");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("show"),2600)}
function errorMessage(e){const c=e?.code||"";const map={"auth/invalid-credential":"Email hoặc mật khẩu không đúng.","auth/email-already-in-use":"Email đã được sử dụng.","auth/weak-password":"Mật khẩu cần ít nhất 6 ký tự.","auth/invalid-email":"Email không hợp lệ.","permission-denied":"Bạn không có quyền thực hiện thao tác này."};return map[c]||"Có lỗi xảy ra. Vui lòng thử lại."}
function initials(n="HS"){return n.trim().split(/\s+/).slice(-2).map(x=>x[0]).join("").toUpperCase()||"HS"}

function renderSchedule(){
 $("#weekText").textContent=`${weekStart.toLocaleDateString("vi-VN")} - ${new Date(weekStart.getTime()+6*86400000).toLocaleDateString("vi-VN")}`;
 $("#scheduleTable").innerHTML=`<thead><tr><th>Buổi / Tiết</th>${DAYS.map(d=>`<th>${d}</th>`).join("")}</tr></thead><tbody>${PERIODS.map(p=>`<tr><td>${p[0]}<br><small>${p[1]}–${p[2]}</small></td>${DAYS.map(d=>`<td><input class="schedule-input" data-day="${d}" data-period="${p[0]}" placeholder="Nhập môn"></td>`).join("")}</tr>`).join("")}</tbody>`;
 loadSchedule().catch(e=>toast(errorMessage(e)));
}
async function loadSchedule(){
 const s=await getDoc(doc(db,"schedules",`${user.uid}_${iso(weekStart)}`));if(!s.exists())return;
 const data=s.data().schedule||{};$$(".schedule-input").forEach(e=>e.value=data[e.dataset.day]?.[e.dataset.period]||"");
}
async function saveSchedule(){
 const schedule={};DAYS.forEach(d=>{schedule[d]={};PERIODS.forEach(p=>{schedule[d][p[0]]=$(`.schedule-input[data-day="${d}"][data-period="${p[0]}"]`)?.value.trim()||""})});
 await setDoc(doc(db,"schedules",`${user.uid}_${iso(weekStart)}`),{userId:user.uid,weekStart:iso(weekStart),schedule,updatedAt:serverTimestamp()},{merge:true});
 toast("Đã lưu thời khóa biểu");
}

function fillSubjects(){
 $("#taskSubject").innerHTML=SUBJECTS.map(s=>`<option value="${escape(s)}">${escape(s)}</option>`).join("");
 $("#subjectFilter").innerHTML=`<option value="all">Tất cả môn</option>`+SUBJECTS.map(s=>`<option>${escape(s)}</option>`).join("");
 $("#taskPeriod").innerHTML=PERIODS.map(p=>`<option value="${p[0]}">${p[0]} (${p[1]}–${p[2]})</option>`).join("");
}
async function loadUsers(){
 const snap=await getDocs(query(collection(db,"users"),orderBy("displayName")));
 users=snap.docs.map(d=>({id:d.id,...d.data()}));
 $("#userFilter").innerHTML=`<option value="all">Tất cả người dùng</option>`+users.map(u=>`<option value="${escape(u.uid)}">${escape(u.displayName||u.email||"Học sinh")}</option>`).join("");
}
async function loadTasks(){
 const snap=await getDocs(query(collection(db,"tasks"),orderBy("date","asc"),orderBy("period","asc")));
 tasks=snap.docs.map(d=>({id:d.id,...d.data()}));renderTasks();
}
function filteredTasks(){
 const today=iso(new Date()),uf=$("#userFilter").value,sf=$("#subjectFilter").value,q=$("#search").value.trim().toLowerCase();
 return tasks.filter(t=>(period==="current"?t.date>=today:t.date<today)&&(uf==="all"||t.createdBy===uf)&&(sf==="all"||t.subject===sf)&&(!q||`${t.subject} ${t.taskContent} ${t.description||""} ${t.authorName||""}`.toLowerCase().includes(q))).sort((a,b)=>a.date.localeCompare(b.date)||PERIODS.findIndex(p=>p[0]===a.period)-PERIODS.findIndex(p=>p[0]===b.period));
}
function renderTasks(){
 const list=filteredTasks();if(!list.length){$("#taskArea").innerHTML=`<div class="empty">Không có nhiệm vụ phù hợp.</div>`;return}
 if(view==="list"){renderList(list);return}
 const groups={};list.forEach(t=>(groups[t.date]??=[]).push(t));
 $("#taskArea").innerHTML=Object.entries(groups).map(([date,arr])=>`<div class="day"><div class="day-head"><strong>📌 ${localDate(date).toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"})}</strong><span>${arr.filter(t=>t.status==="completed").length}/${arr.length} hoàn thành</span></div>${arr.map(taskHtml).join("")}</div>`).join("");
}
function renderList(list){
 $("#taskArea").innerHTML=`<div class="day">${list.map(taskHtml).join("")}</div>`;
}
function taskHtml(t){
 const mine=t.createdBy===user.uid,done=(t.completedBy||[]).includes(user.uid);
 return `<div class="task">
 <div class="period">${escape(t.period||"")}</div><div class="subject">${escape(t.subject)}</div>
 <div><div class="${t.status==="completed"?"completed":""}">${escape(t.taskContent)}</div><div class="author">👤 ${escape(t.authorName||"Học sinh")} · ${Number(t.points||0)} điểm${t.description?` · ${escape(t.description)}`:""}</div></div>
 <button class="complete" data-complete="${t.id}" ${done?"disabled":""}>${done?"✓ Đã nhận":"Hoàn thành"}</button>
 ${mine?`<button class="icon delete" title="Xóa" data-delete="${t.id}"><i class="fa-solid fa-trash"></i></button>`:""}
 </div>`;
}
async function createTask(){
 const date=$("#taskDate").value, p=$("#taskPeriod").value, subject=$("#taskSubject").value;
 const row=PERIODS.find(x=>x[0]===p);const deadline=$("#deadline").value;
 await addDoc(collection(db,"tasks"),{createdBy:user.uid,authorName:profile.displayName||"Học sinh",subject,taskContent:$("#taskContent").value.trim(),date,dayOfWeek:DAYS[Math.min(5,(localDate(date).getDay()+6)%7)],period:p,startTime:row[1],endTime:row[2],deadline:new Date(deadline).toISOString(),description:$("#taskDescription").value.trim(),points:Number($("#taskPoints").value),status:"pending",completedBy:[],completedAt:null,createdAt:serverTimestamp()});
 $("#taskDialog").close();$("#taskForm").reset();setTaskDefaults();await loadTasks();toast("Đã tạo nhiệm vụ");
}
async function completeTask(id){
 await runTransaction(db,async tx=>{
   const ref=doc(db,"tasks",id),snap=await tx.get(ref);if(!snap.exists())throw new Error("not-found");
   const t=snap.data(),completed=t.completedBy||[];if(completed.includes(user.uid))return;
   const now=new Date(),deadline=new Date(t.deadline);const onTime=now<=deadline;
   tx.update(ref,{completedBy:arrayUnion(user.uid),completedAt:serverTimestamp(),status:"completed"});
   if(onTime){
     const uref=doc(db,"users",user.uid);const us=await tx.get(uref);const u=us.data()||{};
     tx.update(uref,{points:Number(u.points||0)+Number(t.points||0),weeklyPoints:Number(u.weeklyPoints||0)+Number(t.points||0),tasksCompleted:Number(u.tasksCompleted||0)+1});
   }
 });
 await loadProfile();await loadTasks();toast("Đã hoàn thành nhiệm vụ");
}
async function deleteTask(id){if(!confirm("Xóa nhiệm vụ này?"))return;await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js").then(async({deleteDoc})=>deleteDoc(doc(db,"tasks",id)));await loadTasks();toast("Đã xóa nhiệm vụ")}

async function loadProfile(){
 const s=await getDoc(doc(db,"users",user.uid));profile=s.data()||{displayName:user.email?.split("@")[0]||"Học sinh",className:"",points:0,weeklyPoints:0,tasksCompleted:0};
 $("#headerName").textContent=profile.displayName||"Học sinh";$("#profileName").textContent=profile.displayName||"Học sinh";$("#profileEmail").textContent=profile.email||user.email||"";$("#avatar").textContent=initials(profile.displayName||"HS");
 $("#profileDisplay").value=profile.displayName||"";$("#profileClass").value=profile.className||"";$("#points").textContent=profile.points||0;$("#weekly").textContent=profile.weeklyPoints||0;$("#completed").textContent=profile.tasksCompleted||0;
}
async function saveProfile(){const name=$("#profileDisplay").value.trim(),cls=$("#profileClass").value.trim();await updateDoc(doc(db,"users",user.uid),{displayName:name,className:cls});await loadProfile();await loadUsers();toast("Đã cập nhật hồ sơ")}

async function leaderboard(){
 const snap=await getDocs(query(collection(db,"users"),orderBy("weeklyPoints","desc")));const top=snap.docs.map(d=>d.data()).slice(0,10);
 $("#ranking").innerHTML=top.length?top.map((u,i)=>`<div class="rank"><strong>#${i+1}</strong><span>${escape(u.displayName||"Học sinh")} <small class="muted">${escape(u.className||"")}</small></span><span>${u.tasksCompleted||0} nhiệm vụ</span><strong>${u.weeklyPoints||0} điểm</strong></div>`).join(""):`<div class="empty">Chưa có dữ liệu xếp hạng.</div>`;
}

function setTaskDefaults(){
 const now=new Date(),d=iso(now);$("#taskDate").value=d;$("#deadline").value=`${d}T23:59`;$("#taskPoints").value=10;
}
function switchTab(name){$$(".nav").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));$$(".tab").forEach(s=>s.classList.toggle("active",s.id===name+"Tab"));if(name==="leaderboard")leaderboard().catch(e=>toast(errorMessage(e)))}

$$(".auth-switch button").forEach(b=>b.onclick=()=>{$$(".auth-switch button").forEach(x=>x.classList.toggle("active",x===b));$("#loginForm").classList.toggle("hidden",b.dataset.auth!=="login");$("#registerForm").classList.toggle("hidden",b.dataset.auth!=="register")});
$("#loginForm").onsubmit=async e=>{e.preventDefault();try{await signInWithEmailAndPassword(auth,$("#loginEmail").value.trim(),$("#loginPassword").value)}catch(x){toast(errorMessage(x))}};
$("#registerForm").onsubmit=async e=>{e.preventDefault();try{const cred=await createUserWithEmailAndPassword(auth,$("#regEmail").value.trim(),$("#regPassword").value);await setDoc(doc(db,"users",cred.user.uid),{uid:cred.user.uid,email:cred.user.email,displayName:$("#regName").value.trim(),className:$("#regClass").value.trim(),points:0,weeklyPoints:0,tasksCompleted:0,createdAt:serverTimestamp()});toast("Tạo tài khoản thành công")}catch(x){toast(errorMessage(x))}};
$("#logout").onclick=()=>signOut(auth);
$$(".nav").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
$("#prevWeek").onclick=()=>{weekStart.setDate(weekStart.getDate()-7);renderSchedule()};$("#nextWeek").onclick=()=>{weekStart.setDate(weekStart.getDate()+7);renderSchedule()};$("#thisWeek").onclick=()=>{weekStart=monday(new Date());renderSchedule()};$("#saveSchedule").onclick=()=>saveSchedule().catch(e=>toast(errorMessage(e)));
$("#newTask").onclick=()=>{$("#taskDialog").showModal();setTaskDefaults()};$("#closeDialog").onclick=()=>$("#taskDialog").close();$("#cancelDialog").onclick=()=>$("#taskDialog").close();$("#taskForm").onsubmit=e=>{e.preventDefault();createTask().catch(x=>toast(errorMessage(x)))};
["userFilter","subjectFilter"].forEach(id=>$( "#"+id).onchange=renderTasks);$("#search").oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(renderTasks,180)};
$$(".seg button").forEach(b=>b.onclick=()=>{$$(".seg button").forEach(x=>x.classList.toggle("active",x===b));view=b.dataset.view;renderTasks()});
$$(".subtabs button").forEach(b=>b.onclick=()=>{$$(".subtabs button").forEach(x=>x.classList.toggle("active",x===b));period=b.dataset.period;renderTasks()});
$("#taskArea").onclick=e=>{const c=e.target.closest("[data-complete]"),d=e.target.closest("[data-delete]");if(c&&!c.disabled)completeTask(c.dataset.complete).catch(x=>toast(errorMessage(x)));if(d)deleteTask(d.dataset.delete).catch(x=>toast(errorMessage(x)))};
$("#profileForm").onsubmit=e=>{e.preventDefault();saveProfile().catch(x=>toast(errorMessage(x)))};

onAuthStateChanged(auth,async u=>{
 user=u;$("#auth").classList.toggle("hidden",!!u);$("#app").classList.toggle("hidden",!u);if(!u)return;
 try{await loadProfile();fillSubjects();renderSchedule();await loadUsers();await loadTasks();}catch(e){toast(errorMessage(e))}
});
