import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore,doc,getDoc,setDoc,updateDoc,addDoc,collection,query,orderBy,getDocs,runTransaction,serverTimestamp,arrayUnion,deleteDoc,onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),provider=new GoogleAuthProvider();
const DAYS=["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7"];
const PERIODS=[
 ["Sáng - Tiết 1","06:55","07:40","Sáng","1"],["Sáng - Tiết 2","07:45","08:30","Sáng","2"],["Sáng - Tiết 3","08:55","09:40","Sáng","3"],["Sáng - Tiết 4","09:45","10:30","Sáng","4"],["Sáng - Tiết 5","10:35","11:20","Sáng","5"],
 ["Chiều - Tiết 1","13:40","14:25","Chiều","1"],["Chiều - Tiết 2","14:25","15:10","Chiều","2"],["Chiều - Tiết 3","15:15","16:00","Chiều","3"],["Chiều - Tiết 4","16:00","16:45","Chiều","4"]
];
const SUBJECTS=["Toán","Ngữ văn","Tiếng Anh","Vật lý","Hóa học","Sinh học","Lịch sử","Thể dục","GDQP","HDTN","KTPL"];
let notificationTimer=null,notificationLastSnapshot="",notificationPanelOpen=false;
let user=null,profile=null,weekStart=monday(new Date()),tasks=[],users=[],view="board",period="current",searchTimer=null,currentSchedule={},taskSchedule={},unsubs=[],scheduleUnsub=null,scheduleListenerKey=null,scheduleRenderToken=0,mobileDayIndex=Math.max(0,Math.min(5,new Date().getDay()-1));

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const iso=d=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`};
function localDate(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function monday(d){const x=new Date(d);x.setHours(0,0,0,0);const n=x.getDay();x.setDate(x.getDate()+(n===0?-6:1-n));return x}
function escape(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function showAuthError(msg){const e=$("#authErr");if(e){e.textContent=msg;e.classList.remove("hidden")}}
function clearAuthError(){const e=$("#authErr");if(e){e.textContent="";e.classList.add("hidden")}}
function toast(msg){const e=$("#toast");e.textContent=msg;e.classList.add("show");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("show"),2600)}
function notificationKey(t,kind="soon"){return `${t.id}:${kind}:${t.deadline||t.date}`}
function taskDeadlineDate(t){const d=t?.deadline?new Date(t.deadline):localDate(t?.date||iso(new Date()));return Number.isNaN(d.getTime())?localDate(t?.date||iso(new Date())):d}
function taskTimeLabel(t){const d=taskDeadlineDate(t),diff=d-Date.now(),day=Math.ceil(diff/86400000);if(diff<0)return "Đã quá hạn";if(day<=1)return "Hôm nay";if(day===2)return "Ngày mai";return `Còn ${day-1} ngày`}
function upcomingTasks(){const now=Date.now(),limit=now+7*86400000;return tasks.filter(t=>t.status!=="completed"||!(t.completedBy||[]).includes(user?.uid)).filter(t=>{const d=taskDeadlineDate(t).getTime();return d>=now-86400000&&d<=limit}).sort((a,b)=>taskDeadlineDate(a)-taskDeadlineDate(b))}
function renderNotificationPanel(){const list=$("#notificationList"),badge=$("#notificationBadge"),summary=$("#notificationSummary");if(!list)return;const items=upcomingTasks();if(badge){badge.textContent=Math.min(items.length,99);badge.classList.toggle("hidden",!items.length)}if(summary)summary.textContent=items.length?`${items.length} nhiệm vụ trong 7 ngày tới`:"Không có nhiệm vụ sắp tới";list.innerHTML=items.length?items.map(t=>{const d=taskDeadlineDate(t),urgent=d-Date.now()<=86400000;return `<button class="notification-item ${urgent?"urgent":""}" data-notification-task="${escape(t.id)}" type="button"><span class="notification-icon">${urgent?"⏰":"📚"}</span><span class="notification-content"><strong>${escape(t.taskContent||"Nhiệm vụ")}</strong><small>${escape(t.subject||"")} · ${taskTimeLabel(t)} · ${d.toLocaleString("vi-VN",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</small></span></button>`}).join(""): `<div class="notification-empty"><span>✨</span><strong>Không có nhiệm vụ sắp tới</strong><small>Những nhiệm vụ trong 7 ngày tới sẽ xuất hiện ở đây.</small></div>`}
function showTaskAlert(t){const e=$("#taskAlert");if(!e)return;const d=taskDeadlineDate(t),urgent=d-Date.now()<=86400000;e.innerHTML=`<div class="task-alert-icon">${urgent?"⏰":"🔔"}</div><div class="task-alert-body"><strong>Nhiệm vụ sắp tới</strong><span>${escape(t.taskContent||"Nhiệm vụ")} · ${escape(t.subject||"")}</span><small>${taskTimeLabel(t)} · hạn ${d.toLocaleString("vi-VN",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</small></div><button class="task-alert-close" type="button" aria-label="Đóng">×</button>`;e.classList.add("show");e.setAttribute("aria-hidden","false");clearTimeout(e._t);e._t=setTimeout(hideTaskAlert,7000);e.querySelector(".task-alert-close")?.addEventListener("click",hideTaskAlert,{once:true})}
function hideTaskAlert(){const e=$("#taskAlert");if(!e)return;e.classList.remove("show");e.setAttribute("aria-hidden","true")}
function browserNotify(t){if(!("Notification"in window)||Notification.permission!=="granted")return;const d=taskDeadlineDate(t);new Notification(`🔔 ${taskTimeLabel(t)}: ${t.subject||"Nhiệm vụ"}`,{body:`${t.taskContent||"Có nhiệm vụ sắp tới"} · Hạn ${d.toLocaleString("vi-VN",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}`,tag:`schooltask-${t.id}`})}
function checkUpcomingNotifications(force=false){if(!user)return;renderNotificationPanel();const items=upcomingTasks(),snapshot=items.map(t=>`${t.id}:${t.deadline}`).join("|");if(!force&&snapshot===notificationLastSnapshot)return;notificationLastSnapshot=snapshot;items.forEach(t=>{const d=taskDeadlineDate(t),hours=(d-Date.now())/3600000;if(hours<0||hours>168)return;const key=notificationKey(t,"popup"),shown=localStorage.getItem(`schooltask-notify:${key}`);if(shown)return;localStorage.setItem(`schooltask-notify:${key}`,String(Date.now()));showTaskAlert(t);browserNotify(t)})}
async function enableDesktopNotifications(){if(!("Notification"in window)){toast("Trình duyệt này không hỗ trợ thông báo màn hình.");return}const permission=await Notification.requestPermission();if(permission==="granted"){toast("✓ Đã bật thông báo màn hình");$("#enableDesktopNotifications").innerHTML='<i class="fa-solid fa-bell"></i> Đã bật thông báo màn hình';checkUpcomingNotifications(true)}else toast("Bạn chưa cấp quyền thông báo màn hình.")}
function openNotifications(){notificationPanelOpen=true;$("#notificationPanel")?.classList.add("show");$("#notificationPanel")?.setAttribute("aria-hidden","false");renderNotificationPanel()}
function closeNotifications(){notificationPanelOpen=false;$("#notificationPanel")?.classList.remove("show");$("#notificationPanel")?.setAttribute("aria-hidden","true")}
function setSyncStatus(kind="online",text="Đang đồng bộ"){
 const el=$("#syncStatus"); if(!el)return;
 el.className=`sync-status ${kind}`;
 const icons={online:"fa-wifi",saving:"fa-rotate fa-spin",error:"fa-triangle-exclamation",offline:"fa-cloud"};
 el.innerHTML=`<i class="fa-solid ${icons[kind]||icons.online}"></i> ${escape(text)}`;
}
function updateOnlineStatus(){setSyncStatus(navigator.onLine?"online":"offline",navigator.onLine?"Đang đồng bộ":"Ngoại tuyến");}

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

function sharedScheduleRef(){ return doc(db,"schedules",iso(weekStart)); }
function sharedScheduleRefFor(date){ return doc(db,"schedules",weekKeyForDate(date)); }
function scheduleForCurrentWeek(){ return currentSchedule||{}; }

function subjectColor(subject=""){
 let h=0; for(const c of subject)h=(h*31+c.charCodeAt(0))%360;
 return `hsl(${h} 72% 42%)`;
}
function scheduleSelect(date,day,p,extra=""){
 const value=currentSchedule[day]?.[p[0]]||"";
 return `<select class="schedule-input" data-day="${escape(day)}" data-period="${escape(p[0])}" aria-label="${escape(day)} ${escape(p[0])}"><option value="">— Chọn môn —</option>${subjectOptions(value)}</select>`;
}
function renderMobileSchedule(){
 const day=DAYS[mobileDayIndex]||DAYS[0],date=iso(new Date(weekStart.getTime()+mobileDayIndex*86400000));
 const row=currentSchedule[day]||{};
 const selector=$("#mobileDaySelector");
 if(selector)selector.innerHTML=DAYS.map((d,i)=>`<button class="day-chip ${i===mobileDayIndex?"active":""}" data-mobile-day="${i}"><b>${d.replace("Thứ ","T")}</b><small>${new Date(weekStart.getTime()+i*86400000).toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})}</small></button>`).join("");
 const area=$("#mobileSchedule");
 if(!area)return;
 area.innerHTML=`<div class="mobile-day-title"><div><span>${day}</span><strong>${localDate(date).toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit"})}</strong></div><span>${Object.values(row).filter(Boolean).length}/9 tiết có môn</span></div>`+
 PERIODS.map(p=>{const subject=row[p[0]]||"";return `<article class="period-card ${p[3]==="Sáng"?"morning":"afternoon"}" style="--subject-color:${subjectColor(subject)}"><div class="period-number"><span>${p[3]==="Sáng"?"☀️":"🌙"}</span><b>Tiết ${p[4]}</b><small>${p[1]}–${p[2]}</small></div><div class="period-subject">${scheduleSelect(date,day,p)}</div><div class="period-task"><select class="schedule-task-select" data-task-date="${date}" data-task-period="${escape(p[0])}" aria-label="Nhiệm vụ ${escape(day)} ${escape(p[0])}"><option value="">📋 Nhiệm vụ</option></select></div></article>`}).join("");
}
function renderSchedule(){
 const weekKey=iso(weekStart),renderToken=++scheduleRenderToken;
 unsubscribeScheduleRealtime(); currentSchedule={};
 const end=new Date(weekStart.getTime()+6*86400000);
 $("#weekText").textContent=`${weekStart.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})} – ${end.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric"})}`;
 const head=`<thead><tr><th rowspan="2" class="day-col">Thứ</th><th colspan="5" class="session morning">☀️ Sáng</th><th colspan="4" class="session afternoon">🌙 Chiều</th></tr><tr>${PERIODS.map(p=>`<th class="period-head ${p[3]==="Sáng"?"morning":"afternoon"}">Tiết ${p[4]}<small>${p[1]}–${p[2]}</small></th>`).join("")}</tr></thead>`;
 const body=`<tbody>${DAYS.map((d,di)=>`<tr><th class="day-name">${d}<small>${new Date(weekStart.getTime()+di*86400000).toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})}</small></th>${PERIODS.map(p=>{const date=iso(new Date(weekStart.getTime()+di*86400000));return `<td class="schedule-cell" data-date="${date}" data-day="${d}" data-period="${p[0]}">${scheduleSelect(date,d,p)}<select class="schedule-task-select" data-task-date="${date}" data-task-period="${p[0]}" aria-label="Nhiệm vụ ${d} ${p[0]}"><option value="">📋 Nhiệm vụ</option></select></td>`}).join("")}</tr>`).join("")}</tbody>`;
 $("#scheduleTable").innerHTML=head+body; renderMobileSchedule(); applyScheduleToUI();
 if(user)subscribeScheduleRealtime(weekKey,renderToken);
}

function applyScheduleToUI(){
 $$(".schedule-input").forEach(e=>e.value=currentSchedule[e.dataset.day]?.[e.dataset.period]||"");
 renderMobileSchedule();
 renderScheduleTaskDropdowns();
}

function subscribeScheduleRealtime(expectedWeekKey=iso(weekStart),renderToken=scheduleRenderToken){
 unsubscribeScheduleRealtime();
 if(!user)return;
 const ref=doc(db,"schedules",expectedWeekKey);
 scheduleListenerKey=expectedWeekKey;
 scheduleUnsub=onSnapshot(ref,snap=>{
   // Ignore a late callback from an old week/user render.
   if(!user || scheduleListenerKey!==expectedWeekKey || renderToken!==scheduleRenderToken) return;
   const incoming=snap.exists()?(snap.data().schedule||{}):{};
   const changed=JSON.stringify(incoming)!==JSON.stringify(currentSchedule);
   currentSchedule=incoming;
   applyScheduleToUI();
   setSyncStatus("online","Đang đồng bộ");
   if(changed && snap.exists() && snap.metadata?.hasPendingWrites===false) toast("🔄 TKB vừa được cập nhật");
   syncTaskDropdown().catch(e=>console.warn("sync task dropdown after schedule update:",e));
 },e=>{
   if(scheduleListenerKey!==expectedWeekKey || renderToken!==scheduleRenderToken)return;
   console.error("schedule listener",e);
   setSyncStatus("error","Lỗi đồng bộ");
   toast(`Không thể đồng bộ TKB: ${errorMessage(e)}`);
 });
}

function unsubscribeScheduleRealtime(){
 if(scheduleUnsub){ try{scheduleUnsub()}catch(e){console.warn("unsubscribe schedule failed",e)} scheduleUnsub=null; }
 scheduleListenerKey=null;
}

function syncScheduleInputGroup(source){
 const day=source?.dataset?.day, period=source?.dataset?.period;
 if(!day||!period)return;
 const value=source.value||"";
 $$(`.schedule-input[data-day="${CSS.escape(day)}"][data-period="${CSS.escape(period)}"]`).forEach(input=>{
   if(input!==source && input.value!==value)input.value=value;
 });
 currentSchedule[day]??={};
 currentSchedule[day][period]=value;
 renderScheduleTaskDropdowns();
}

function collectScheduleFromUI(){
 const schedule={};
 DAYS.forEach(d=>{
   schedule[d]={};
   PERIODS.forEach(p=>{
     const inputs=$$(`.schedule-input[data-day="${CSS.escape(d)}"][data-period="${CSS.escape(p[0])}"]`);
     // Desktop and mobile render the same cell. The change handler keeps them
     // mirrored, so the first value is enough; fall back to any non-empty value.
     schedule[d][p[0]]=inputs.find(x=>x.value)?.value||inputs[0]?.value||"";
   });
 });
 return schedule;
}

async function saveSchedule(){
 if(!user){
   toast("Bạn chưa đăng nhập. Hãy đăng nhập rồi lưu thời khóa biểu.");
   throw new Error("Bạn chưa đăng nhập. Hãy đăng nhập rồi lưu thời khóa biểu.");
 }
 const uid=user.uid;
 const weekKey=iso(weekStart);
 const ref=doc(db,"schedules",weekKey);
 // Collect ALL 6 days in one pass. Mobile and desktop inputs are mirrored,
 // so changing any day/period is included in this single weekly write.
 const schedule=collectScheduleFromUI();
 try {
  setSyncStatus("saving","Đang lưu...");
  await setDoc(ref,{
   weekStart:weekKey,
   schedule,
   updatedAt:serverTimestamp(),
   updatedBy:uid,
   updatedByName:profile?.displayName||user.displayName||"Học sinh"
  },{merge:true});
  // Keep local UI responsive; the realtime listener remains the source of truth.
  if(user?.uid===uid && iso(weekStart)===weekKey){
   currentSchedule=schedule;
   applyScheduleToUI();
  }
  setSyncStatus("online","Đang đồng bộ");
  toast("✓ Đã cập nhật TKB chung");
 } catch(e) {
  console.error("saveSchedule failed:",e);
  setSyncStatus("error","Lưu thất bại");
  toast(`Lưu TKB thất bại: ${errorMessage(e)}`);
  throw e;
 }
}

async function loadScheduleForCurrentWeek(){
 // Kept for compatibility with existing callers; realtime listener handles live updates.
 if(!user)return {};
 const weekKey=iso(weekStart);
 const s=await getDoc(doc(db,"schedules",weekKey));
 if(iso(weekStart)!==weekKey)return currentSchedule;
 currentSchedule=s.exists()?(s.data().schedule||{}):{};
 applyScheduleToUI();
 return currentSchedule;
}
function renderScheduleTaskDropdowns(){
 $$(".schedule-task-select").forEach(sel=>{
   const date=sel.dataset.taskDate, p=sel.dataset.taskPeriod;
   const subject=currentSchedule[dayFromDate(date)]?.[p]||"";
   const matching=tasks.filter(t=>t.date===date&&t.period===p&&(!subject||t.subject===subject));
   sel.innerHTML=`<option value="">${matching.length?`📋 ${matching.length} nhiệm vụ`:`📋 Chưa có nhiệm vụ`}</option>`+matching.map(t=>`<option value="${escape(t.id)}">${escape(t.taskContent)} · ${Number(t.points||0)}đ</option>`).join("");
 });
}
function scheduleSubjectsForDate(date){
 const day=dayFromDate(date),row=currentSchedule[day]||{};
 return [...new Set(PERIODS.map(p=>row[p[0]]).filter(Boolean))];
}
async function loadScheduleForDate(date){
 const key=weekKeyForDate(date);
 if(key===iso(weekStart))return currentSchedule;
 const s=await getDoc(doc(db,"schedules",key));
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
 const snap=await getDocs(query(collection(db,"tasks"),orderBy("date","asc")));
 tasks=snap.docs.map(d=>({id:d.id,...d.data()}));renderTasks();renderScheduleTaskDropdowns();checkUpcomingNotifications(true);
}
function subscribeRealtime(){
 // Schedule has its own lifecycle because week navigation replaces its document listener.
 subscribeScheduleRealtime(iso(weekStart),scheduleRenderToken);
 unsubs.push(onSnapshot(query(collection(db,"tasks"),orderBy("date","asc")),snap=>{
   tasks=snap.docs.map(d=>({id:d.id,...d.data()}));
   renderTasks(); renderScheduleTaskDropdowns(); checkUpcomingNotifications();
 },e=>console.warn("task listener",e)));
 unsubs.push(onSnapshot(query(collection(db,"users"),orderBy("displayName")),snap=>{
   users=snap.docs.map(d=>({id:d.id,...d.data()}));
   $("#userFilter").innerHTML=`<option value="all">Tất cả người dùng</option>`+users.map(u=>`<option value="${escape(u.uid)}">${escape(u.displayName||u.email||"Học sinh")}</option>`).join("");
   if($( "#leaderboardTab").classList.contains("active"))leaderboard().catch(()=>{});
 },e=>console.warn("users listener",e)));
 unsubs.push(onSnapshot(doc(db,"users",user.uid),snap=>{
   if(snap.exists()){ profile=snap.data(); updateProfileUI(); }
 },e=>console.warn("profile listener",e)));
}
function unsubscribeRealtime(){
 unsubscribeScheduleRealtime();
 unsubs.forEach(fn=>{try{fn()}catch{}});
 unsubs=[];
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
 if(!user)throw new Error("Bạn chưa đăng nhập. Hãy đăng nhập rồi tạo nhiệm vụ.");
 const date=$("#taskDate").value,p=$("#taskPeriod").value,subject=$("#taskSubject").value,deadline=$("#deadline").value,content=$("#taskContent").value.trim(),points=Number($("#taskPoints").value);
 const row=periodByKey(p);
 if(!date||!subject||!row||!content)throw new Error("Vui lòng chọn đủ ngày, môn, tiết và nhập nhiệm vụ.");
 const schedule=await loadScheduleForDate(date),day=dayFromDate(date);
 if(schedule[day]?.[p]!==subject)throw new Error("Môn học không khớp với thời khóa biểu chung của ngày/tiết này.");
 if(!deadline)throw new Error("Vui lòng chọn hạn nộp.");
 await addDoc(collection(db,"tasks"),{createdBy:user.uid,authorName:profile?.displayName||user.displayName||"Học sinh",subject,taskContent:content,date,dayOfWeek:day,period:p,startTime:row[1],endTime:row[2],deadline:new Date(deadline).toISOString(),description:$("#taskDescription").value.trim(),points,status:"pending",completedBy:[],completedAt:null,createdAt:serverTimestamp()});
 $("#taskDialog").close();$("#taskForm").reset();setTaskDefaults();toast("Đã tạo nhiệm vụ — mọi người sẽ thấy ngay");checkUpcomingNotifications(true);
}
async function completeTask(id){
 await runTransaction(db,async tx=>{
  const ref=doc(db,"tasks",id),snap=await tx.get(ref);if(!snap.exists())throw new Error("not-found");
  const t=snap.data(),completed=t.completedBy||[];if(completed.includes(user.uid))return;
  const now=new Date(),deadline=new Date(t.deadline),onTime=now<=deadline;
  let uref=null,us=null,u=null;
  if(onTime){uref=doc(db,"users",user.uid);us=await tx.get(uref);u=us.data()||{};}
  tx.update(ref,{completedBy:arrayUnion(user.uid),completedAt:serverTimestamp(),status:"completed"});
  if(onTime)tx.update(uref,{points:Number(u.points||0)+Number(t.points||0),weeklyPoints:Number(u.weeklyPoints||0)+Number(t.points||0),tasksCompleted:Number(u.tasksCompleted||0)+1});
 });
 await loadProfile();await loadTasks();toast("Đã hoàn thành nhiệm vụ");
}
async function deleteTask(id){if(!confirm("Xóa nhiệm vụ này?"))return;await deleteDoc(doc(db,"tasks",id));await loadTasks();toast("Đã xóa nhiệm vụ")}

function updateProfileUI(){
 $("#headerName").textContent=profile?.displayName||"Học sinh";$("#profileName").textContent=profile?.displayName||"Học sinh";$("#profileEmail").textContent=profile?.email||user?.email||"";$("#avatar").textContent=initials(profile?.displayName||"HS");
 $("#profileDisplay").value=profile?.displayName||"";$("#profileClass").value=profile?.className||"";$("#points").textContent=profile?.points||0;$("#weekly").textContent=profile?.weeklyPoints||0;$("#completed").textContent=profile?.tasksCompleted||0;
}
async function loadProfile(){
 const s=await getDoc(doc(db,"users",user.uid));profile=s.data()||{displayName:user.email?.split("@")[0]||"Học sinh",className:"",points:0,weeklyPoints:0,tasksCompleted:0};updateProfileUI();
}
async function saveProfile(){const name=$("#profileDisplay").value.trim(),cls=$("#profileClass").value.trim();await updateDoc(doc(db,"users",user.uid),{displayName:name,className:cls});await loadProfile();await loadUsers();toast("Đã cập nhật hồ sơ")}
async function leaderboard(){const snap=await getDocs(query(collection(db,"users"),orderBy("weeklyPoints","desc")));const top=snap.docs.map(d=>d.data()).slice(0,10);$("#ranking").innerHTML=top.length?top.map((u,i)=>`<div class="rank"><strong>#${i+1}</strong><span>${escape(u.displayName||"Học sinh")} <small class="muted">${escape(u.className||"")}</small></span><span>${u.tasksCompleted||0} nhiệm vụ</span><strong>${u.weeklyPoints||0} điểm</strong></div>`).join(""):`<div class="empty">Chưa có dữ liệu xếp hạng.</div>`}
function setTaskDefaults(){const d=iso(new Date());$("#taskDate").value=d;$("#deadline").value=`${d}T23:59`;syncTaskDropdown().catch(()=>{});$("#taskPoints").value=10}
function switchTab(name){$$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));$$('.tab').forEach(s=>s.classList.toggle('active',s.id===name+'Tab'));if(name==='leaderboard')leaderboard().catch(e=>toast(errorMessage(e)))}

$("#googleLogin").onclick=async()=>{clearAuthError();const btn=$("#googleLogin");btn.disabled=true;btn.innerHTML='<i class="fa-brands fa-google"></i> Đang đăng nhập...';try{await signInWithPopup(auth,provider)}catch(x){console.error("Firebase Google login error:",x);showAuthError(errorMessage(x))}finally{btn.disabled=false;btn.innerHTML='<i class="fa-brands fa-google"></i> Đăng nhập bằng Google'}};
$("#logout").onclick=()=>signOut(auth);
$$('.nav').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
$("#notificationBtn")?.addEventListener("click",()=>notificationPanelOpen?closeNotifications():openNotifications());
$("#closeNotifications")?.addEventListener("click",closeNotifications);
$("#enableDesktopNotifications")?.addEventListener("click",()=>enableDesktopNotifications().catch(e=>toast(errorMessage(e))));
$("#notificationList")?.addEventListener("click",e=>{const b=e.target.closest("[data-notification-task]");if(!b)return;const t=tasks.find(x=>x.id===b.dataset.notificationTask);if(t){closeNotifications();switchTab("tasks");setTimeout(()=>document.querySelector(`[data-complete="${CSS.escape(t.id)}"]`)?.scrollIntoView({behavior:"smooth",block:"center"}),80)}});
document.addEventListener("click",e=>{if(notificationPanelOpen&&!e.target.closest("#notificationPanel,#notificationBtn"))closeNotifications()});
$("#prevWeek").onclick=()=>{weekStart.setDate(weekStart.getDate()-7);renderSchedule()};
$("#nextWeek").onclick=()=>{weekStart.setDate(weekStart.getDate()+7);renderSchedule()};
$("#thisWeek").onclick=()=>{weekStart=monday(new Date());renderSchedule()};
document.addEventListener("change",e=>{
 const input=e.target.closest?.(".schedule-input");
 if(input)syncScheduleInputGroup(input);
});
$("#saveSchedule").onclick=()=>saveSchedule().catch(e=>toast(errorMessage(e)));
$("#newTask").onclick=()=>{$("#taskDialog").showModal();setTaskDefaults()};
$("#closeDialog").onclick=()=>$("#taskDialog").close();$("#cancelDialog").onclick=()=>$("#taskDialog").close();
$("#taskForm").onsubmit=e=>{e.preventDefault();createTask().catch(x=>toast(errorMessage(x)))};
$("#taskDate").onchange=()=>syncTaskDropdown().catch(e=>toast(errorMessage(e)));
$("#taskSubject").onchange=()=>syncTaskPeriods();
["userFilter","subjectFilter"].forEach(id=>$("#"+id).onchange=renderTasks);
$("#search").oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(renderTasks,180)};
$$('.seg button').forEach(b=>b.onclick=()=>{$$('.seg button').forEach(x=>x.classList.toggle('active',x===b));view=b.dataset.view;renderTasks()});
$$('.subtabs button').forEach(b=>b.onclick=()=>{$$('.subtabs button').forEach(x=>x.classList.toggle('active',x===b));period=b.dataset.period;renderTasks()});
$("#taskArea").onclick=e=>{const c=e.target.closest('[data-complete]'),d=e.target.closest('[data-delete]');if(c&&!c.disabled)completeTask(c.dataset.complete).catch(x=>toast(errorMessage(x)));if(d)deleteTask(d.dataset.delete).catch(x=>toast(errorMessage(x)))};
$("#profileForm").onsubmit=e=>{e.preventDefault();saveProfile().catch(x=>toast(errorMessage(x)))};

$("#mobileDaySelector")?.addEventListener("click",e=>{const b=e.target.closest("[data-mobile-day]");if(!b)return;mobileDayIndex=Number(b.dataset.mobileDay);renderMobileSchedule();renderScheduleTaskDropdowns();});
window.addEventListener("online",updateOnlineStatus);
window.addEventListener("offline",updateOnlineStatus);
updateOnlineStatus();
notificationTimer=setInterval(()=>checkUpcomingNotifications(),60000);

onAuthStateChanged(auth,async u=>{
 user=u;
 if(u){
  clearAuthError();$("#auth").classList.add('hidden');$("#app").classList.remove('hidden');$("#headerName").textContent=u.displayName||u.email||"";
  try{const userRef=doc(db,"users",u.uid),existing=await getDoc(userRef);if(!existing.exists())await setDoc(userRef,{uid:u.uid,email:u.email||"",displayName:u.displayName||u.email?.split('@')[0]||"Học sinh",className:"",points:0,weeklyPoints:0,tasksCompleted:0,createdAt:serverTimestamp()});await loadProfile();fillSubjects();renderSchedule();await loadUsers();await loadTasks();subscribeRealtime()}catch(e){console.error("Firebase init error:",e);toast(errorMessage(e))}
 }else{notificationLastSnapshot="";if(notificationPanelOpen)closeNotifications();scheduleRenderToken++;unsubscribeRealtime();$("#auth").classList.remove('hidden');$("#app").classList.add('hidden');clearAuthError()}
});
