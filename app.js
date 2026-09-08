import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  signOut, signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

import { auth, db, googleProvider } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const path = location.pathname.split("/").pop() || "index.html";
const isAuthPage = ["login.html", "register.html"].includes(path);
const page = path.replace(".html", "") || "index";

let currentUser = null;
let profile = null;
let role = "user";
let tasks = [];
let completions = new Set();
let unsubTasks = [];
let unsubCompletions = null;

const roleNames = {
  user: "Học sinh",
  moderator: "Moderator",
  assistant: "Assistant Admin",
  admin: "Admin"
};

const subjects = {
  "Toán":"toan","Văn":"van","Lý":"ly","Hóa":"hoa","Sinh":"sinh","Sử":"su",
  "Tiếng Anh":"tienganh","GDTC":"gdtc","HĐTN":"hdtn","GDQPAN":"gdqpan","GDKT&PL":"gdktpl"
};

function esc(v="") {
  return String(v).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}
function initials(name="Học sinh") {
  return name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() || "H";
}
function showMessage(el, msg, ok=false) {
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("success", ok);
}
function fmtDate(v) {
  if (!v) return "Chưa đặt";
  const d = v?.toDate ? v.toDate() : new Date(v);
  if (Number.isNaN(d.getTime())) return "Chưa đặt";
  return d.toLocaleDateString("vi-VN");
}
function fmtDateTime(v) {
  if (!v) return "Chưa đặt";
  const d = v?.toDate ? v.toDate() : new Date(v);
  return d.toLocaleString("vi-VN", {dateStyle:"short", timeStyle:"short"});
}
function dateKey(v) {
  const d = v?.toDate ? v.toDate() : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0,10);
}
function todayKey() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,10);
}
function visibilityLabel(v) {
  return v === "shared" ? "CHUNG" : v === "public" ? "CÔNG KHAI" : "RIÊNG TƯ";
}
function priorityLabel(v) {
  return ({low:"Thấp", medium:"Vừa", high:"Cao"})[v] || "Vừa";
}
function isManager() {
  return ["moderator","assistant","admin"].includes(role);
}
function isAdmin() {
  return role === "admin";
}

function navMarkup() {
  return `
    <aside class="sidebar">
      <a class="brand" href="index.html"><span>📚</span> Học Tập Cộng Đồng</a>
      <nav class="side-nav">
        <a class="nav-link ${page==="index"?"active":""}" href="index.html">⌂ <span>Trang chủ</span></a>
        <a class="nav-link ${page==="community"?"active":""}" href="community.html">◉ <span>Cộng đồng</span></a>
        <a class="nav-link ${page==="leaderboard"?"active":""}" href="leaderboard.html">🏆 <span>Bảng vàng</span></a>
        <a class="nav-link ${page==="profile"?"active":""}" href="profile.html">● <span>Hồ sơ</span></a>
        ${isManager() ? `<a class="nav-link ${page==="admin"?"active":""}" href="admin.html">⚙ <span>Quản trị</span></a>` : ""}
      </nav>
      <div class="side-user">
        <div class="avatar">${esc(initials(profile?.displayName || currentUser?.displayName))}</div>
        <div class="side-user-text">
          <strong>${esc(profile?.displayName || "Học sinh")}</strong>
          <small>${esc(roleNames[role] || role)}</small>
        </div>
      </div>
      <button id="logoutBtn" class="logout">↪ Đăng xuất</button>
    </aside>`;
}

function shell(title, subtitle, content, actions="") {
  document.body.innerHTML = `
    <div class="app">
      ${navMarkup()}
      <main class="main">
        <header class="topbar">
          <div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
          <div class="top-actions">${actions}</div>
        </header>
        <div class="content">${content}</div>
      </main>
    </div>
    <div id="modalRoot"></div>`;
  $("logoutBtn").onclick = () => signOut(auth);
}

function renderAuth(mode) {
  document.body.innerHTML = `
    <main class="auth-shell">
      <section class="auth-card">
        <a class="auth-logo" href="login.html">📚</a>
        <h1>Học Tập Cộng Đồng</h1>
        <p class="subtitle">${mode==="login" ? "Đăng nhập để bắt đầu" : "Tạo tài khoản học tập của bạn"}</p>
        <form id="authForm" class="auth-form">
          ${mode==="register" ? `
            <label>Họ tên<input id="nameInput" type="text" autocomplete="name" placeholder="Nguyễn Văn A" required></label>
            <label>Lớp học
              <select id="classInput" required>
                <option value="">Chọn lớp</option>
                ${["10T1","10T2","10T3","11T1","11T2","11T3","12T1","12T2","12T3"].map(x=>`<option>${x}</option>`).join("")}
              </select>
            </label>` : ""}
          <label>Email<input id="emailInput" type="email" autocomplete="email" placeholder="email@example.com" required></label>
          <label>Mật khẩu<input id="passwordInput" type="password" autocomplete="${mode==="login"?"current-password":"new-password"}" minlength="6" placeholder="Tối thiểu 6 ký tự" required></label>
          ${mode==="register" ? `<label>Xác nhận mật khẩu<input id="confirmInput" type="password" autocomplete="new-password" placeholder="Nhập lại mật khẩu" required></label>` : ""}
          <div id="authError" class="error" role="alert"></div>
          <button class="primary wide" type="submit">${mode==="login"?"Đăng nhập":"Đăng ký tài khoản"}</button>
        </form>
        ${mode==="login" ? `<button id="googleBtn" class="google-btn">G&nbsp; Đăng nhập bằng Google</button>` : ""}
        <p class="auth-switch">${mode==="login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}
          <a href="${mode==="login"?"register.html":"login.html"}">${mode==="login"?"Đăng ký":"Đăng nhập"}</a>
        </p>
        <p class="auth-footer">© ${new Date().getFullYear()} Nguyễn Trung Trực</p>
      </section>
    </main>`;

  $("authForm").onsubmit = async e => {
    e.preventDefault();
    showMessage($("authError"), "");
    const email = $("emailInput").value.trim();
    const password = $("passwordInput").value;
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const name = $("nameInput").value.trim();
        const className = $("classInput").value;
        const confirm = $("confirmInput").value;
        if (password !== confirm) throw new Error("Mật khẩu xác nhận không khớp.");
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, {displayName:name});
        await setDoc(doc(db,"users",cred.user.uid), {
          uid: cred.user.uid, displayName:name, email, className,
          role:"user", points:0, weeklyPoints:0, completedCount:0, postCount:0,
          createdAt:serverTimestamp()
        }, {merge:true});
      }
    } catch (err) {
      showMessage($("authError"), friendlyAuthError(err));
    }
  };
  if ($("googleBtn")) $("googleBtn").onclick = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const snap = await getDoc(doc(db,"users",cred.user.uid));
      if (!snap.exists()) await setDoc(doc(db,"users",cred.user.uid), {
        uid:cred.user.uid, displayName:cred.user.displayName || "Học sinh",
        email:cred.user.email || "", role:"user", points:0, weeklyPoints:0,
        completedCount:0, postCount:0, createdAt:serverTimestamp()
      });
    } catch(err) { showMessage($("authError"), friendlyAuthError(err)); }
  };
}
function friendlyAuthError(err) {
  const map = {
    "auth/invalid-credential":"Email hoặc mật khẩu không đúng.",
    "auth/email-already-in-use":"Email này đã được đăng ký.",
    "auth/invalid-email":"Email không hợp lệ.",
    "auth/weak-password":"Mật khẩu cần ít nhất 6 ký tự.",
    "auth/popup-closed-by-user":"Bạn đã đóng cửa sổ đăng nhập Google."
  };
  return map[err.code] || err.message || "Có lỗi xảy ra.";
}

async function loadProfile() {
  const snap = await getDoc(doc(db,"users",currentUser.uid));
  if (!snap.exists()) {
    profile = {
      uid:currentUser.uid, displayName:currentUser.displayName || "Học sinh",
      email:currentUser.email || "", role:"user", points:0, weeklyPoints:0,
      completedCount:0, postCount:0
    };
    await setDoc(doc(db,"users",currentUser.uid), profile, {merge:true});
  } else profile = snap.data();

  const token = await currentUser.getIdTokenResult(true);
  role = token.claims.role || profile.role || "user";
}

function taskVisibilityQuery() {
  return query(collection(db,"tasks"), where("visibility","in",["public","shared"]), orderBy("createdAt","desc"));
}
function startTaskListeners() {
  unsubTasks.forEach(fn => fn && fn());
  unsubTasks = [];
  const publicUnsub = onSnapshot(taskVisibilityQuery(), snap => {
    const publicTasks = snap.docs.map(d=>({id:d.id,...d.data()}));
    const privateQ = query(collection(db,"tasks"), where("ownerId","==",currentUser.uid), where("visibility","==","private"));
    const privateUnsub = onSnapshot(privateQ, psnap => {
      const privateTasks = psnap.docs.map(d=>({id:d.id,...d.data()}));
      const map = new Map([...publicTasks,...privateTasks].map(t=>[t.id,t]));
      tasks = [...map.values()].sort((a,b)=>dateVal(b.createdAt)-dateVal(a.createdAt));
      renderCurrentPage();
    }, console.error);
    unsubTasks.push(privateUnsub);
    renderCurrentPage();
  }, err => console.error("Task listener:", err));
  unsubTasks.push(publicUnsub);

  if (unsubCompletions) unsubCompletions();
  const cq = query(collection(db,"task_completions"), where("uid","==",currentUser.uid));
  unsubCompletions = onSnapshot(cq, snap => {
    completions = new Set(snap.docs.map(d=>d.data().taskId));
    renderCurrentPage();
  }, console.error);
}
function dateVal(v) {
  if (!v) return 0;
  const d=v?.toDate?v.toDate():new Date(v);
  return d.getTime() || 0;
}

function taskCard(t, options={}) {
  const done = completions.has(t.id);
  const canComplete = !done && (t.visibility !== "private" || t.ownerId === currentUser.uid);
  const subject = t.subject || "Chung";
  const subjectClass = subjects[subject] || "default";
  return `
    <article class="task-card ${done?"is-done":""}">
      <div class="task-top">
        <span class="badge badge-${t.visibility||"shared"}">${t.visibility==="shared"?"📌":"🌐"} ${visibilityLabel(t.visibility)}</span>
        <span class="priority priority-${esc(t.priority||"medium")}">${priorityLabel(t.priority)}</span>
      </div>
      <h3>${esc(t.title || "Không có tiêu đề")}</h3>
      <p class="task-desc">${esc(t.description || "Không có mô tả.")}</p>
      <div class="task-meta">
        <span class="subject-pill subject-${subjectClass}">${esc(subject)}</span>
        <span>⏰ ${esc(fmtDate(t.deadline))}</span>
      </div>
      <div class="task-author">bởi <b>${esc(t.ownerName || "Học sinh")}</b></div>
      <div class="task-foot">
        <span class="${done?"status-done":"muted"}">${done?"✓ Đã hoàn thành":"Chưa hoàn thành"}</span>
        ${canComplete ? `<button class="complete-btn" data-complete="${esc(t.id)}">Hoàn thành</button>` : ""}
      </div>
    </article>`;
}

function bindCompleteButtons() {
  document.querySelectorAll("[data-complete]").forEach(btn => btn.onclick = () => completeTask(btn.dataset.complete));
}
async function completeTask(id) {
  const t = tasks.find(x=>x.id===id);
  if (!t || completions.has(id)) return;
  try {
    await setDoc(doc(db,"task_completions",`${id}_${currentUser.uid}`), {
      taskId:id, uid:currentUser.uid, completedAt:serverTimestamp()
    });
  } catch(err) {
    alert(err.message || "Không thể ghi nhận hoàn thành.");
  }
}

function renderHome() {
  const today = todayKey();
  const todayTasks = tasks.filter(t=>dateKey(t.deadline)===today && (t.visibility!=="private" || t.ownerId===currentUser.uid));
  const doneToday = todayTasks.filter(t=>completions.has(t.id)).length;
  const percent = todayTasks.length ? Math.round(doneToday/todayTasks.length*100) : 0;
  const content = `
    <section class="hero">
      <div><span class="eyebrow">HỌC TẬP CỘNG ĐỒNG</span>
      <h2>Học tập có tổ chức,<br>cùng nhau tiến bộ.</h2>
      <p>Chia sẻ nhiệm vụ, hoàn thành bài tập và tích điểm mỗi tuần.</p></div>
      <div class="hero-icon">📚</div>
    </section>
    <section class="stats">
      <div class="stat-card"><strong>${tasks.filter(t=>t.ownerId===currentUser.uid).length}</strong><span>Nhiệm vụ của tôi</span></div>
      <div class="stat-card"><strong>${tasks.filter(t=>t.visibility!=="private").length}</strong><span>Trong cộng đồng</span></div>
      <div class="stat-card"><strong>${Number(profile.points||0)}</strong><span>Tổng điểm</span></div>
    </section>
    <section class="card today-card">
      <div class="section-head"><div><h2>📋 Nhiệm vụ hôm nay</h2><p>${doneToday}/${todayTasks.length} đã hoàn thành</p></div><strong>${percent}%</strong></div>
      <div class="progress"><div style="width:${percent}%"></div></div>
      ${todayTasks.length ? `<div class="task-list">${todayTasks.map(t=>taskRow(t)).join("")}</div>` : `<div class="empty">Hôm nay chưa có nhiệm vụ có hạn. Tạo một nhiệm vụ để bắt đầu.</div>`}
    </section>
    <section><div class="section-head"><div><h2>Nhiệm vụ mới</h2><p>Các nhiệm vụ gần đây</p></div><a class="link-btn" href="community.html">Xem cộng đồng →</a></div>
      <div class="task-grid">${tasks.slice(0,6).map(t=>taskCard(t)).join("") || `<div class="empty">Chưa có nhiệm vụ.</div>`}</div>
    </section>
    <footer>© ${new Date().getFullYear()} Nguyễn Trung Trực - Học Tập Cộng Đồng</footer>`;
  shell("Trang chủ","Tuần học · nhiệm vụ và tiến độ",content,`<button class="primary" id="openCreate">＋ Tạo nhiệm vụ</button>`);
  bindCompleteButtons();
  $("openCreate").onclick=openTaskModal;
}
function taskRow(t) {
  const done=completions.has(t.id);
  return `<div class="task-row ${done?"completed":""}">
    <div class="check-icon">${done?"✓":"☐"}</div>
    <div><strong>${esc(t.title)}</strong><small>${esc(t.subject||"Chung")} · ⏰ ${esc(fmtDate(t.deadline))}</small></div>
    <span class="status ${done?"done":"pending"}">${done?"Xong":"Còn lại"}</span>
    ${!done?`<button class="mini-btn" data-complete="${esc(t.id)}">Hoàn thành</button>`:""}
  </div>`;
}

function renderCommunity() {
  const content=`
    <section class="card">
      <div class="community-toolbar">
        <input id="searchInput" placeholder="🔍 Tìm kiếm nhiệm vụ..." aria-label="Tìm kiếm nhiệm vụ">
        <select id="subjectFilter"><option value="">Tất cả môn học</option>${Object.keys(subjects).map(s=>`<option>${s}</option>`).join("")}</select>
        <select id="visibilityFilter"><option value="">Tất cả loại</option><option value="shared">Chung</option><option value="public">Công khai</option><option value="private">Riêng tư</option></select>
        <select id="dateFilter"><option value="">Mọi ngày</option><option value="today">Hôm nay</option><option value="upcoming">Sắp tới</option><option value="overdue">Quá hạn</option></select>
      </div>
    </section>
    <section><div class="section-head"><div><h2>Nhiệm vụ cộng đồng</h2><p>Các nhiệm vụ công khai và chung</p></div><span class="muted" id="resultCount"></span></div>
      <div id="communityGrid" class="task-grid"></div>
    </section>
    <button class="load-more" id="loadMore">Tải thêm</button>
    <button class="fab" id="openCreate" aria-label="Tạo nhiệm vụ">＋</button>`;
  shell("Cộng đồng","Chia sẻ nhiệm vụ và cùng nhau tiến bộ",content);
  let visibleCount=9;
  const filter=()=>{
    const s=$("searchInput").value.toLowerCase().trim(), sub=$("subjectFilter").value;
    const vis=$("visibilityFilter").value, df=$("dateFilter").value, now=Date.now();
    let list=tasks.filter(t=>t.visibility!=="private" || t.ownerId===currentUser.uid);
    list=list.filter(t=>
      (!s || `${t.title||""} ${t.description||""} ${t.ownerName||""}`.toLowerCase().includes(s)) &&
      (!sub || t.subject===sub) && (!vis || t.visibility===vis) &&
      (!df || (df==="today" && dateKey(t.deadline)===todayKey()) ||
       (df==="upcoming" && dateVal(t.deadline)>=now) ||
       (df==="overdue" && dateVal(t.deadline)<now))
    );
    $("resultCount").textContent=`${list.length} nhiệm vụ`;
    $("communityGrid").innerHTML=list.slice(0,visibleCount).map(t=>taskCard(t)).join("") || `<div class="empty">Không tìm thấy nhiệm vụ phù hợp.</div>`;
    $("loadMore").classList.toggle("hidden",visibleCount>=list.length);
    bindCompleteButtons();
  };
  ["searchInput","subjectFilter","visibilityFilter","dateFilter"].forEach(id=>$(id).addEventListener("input",()=>{visibleCount=9;filter()}));
  $("loadMore").onclick=()=>{visibleCount+=9;filter()};
  $("openCreate").onclick=openTaskModal;
  filter();
}

function renderLeaderboard() {
  const content=`
    <section class="card">
      <div class="leader-head"><div><span class="eyebrow">🏆 BẢNG VÀNG</span><h2>Xếp hạng tuần</h2><p class="muted">Dữ liệu lấy từ collection <code>rankings</code>.</p></div><span class="week-badge">${weekLabel()}</span></div>
      <div id="rankingList"><div class="empty">Đang tải bảng xếp hạng...</div></div>
    </section>
    <section class="card badge-section"><h2>🏅 Huy hiệu đặc biệt</h2><div id="topBadges" class="top-badges"></div></section>`;
  shell("Bảng vàng","Thi đua tích điểm theo tuần",content);
  loadRankings();
}
function weekLabel() {
  const d=new Date(), day=(d.getDay()+6)%7, mon=new Date(d); mon.setDate(d.getDate()-day);
  const sun=new Date(mon); sun.setDate(mon.getDate()+6);
  return `${mon.toLocaleDateString("vi-VN")} - ${sun.toLocaleDateString("vi-VN")}`;
}
async function loadRankings() {
  try {
    const snap=await getDocs(query(collection(db,"rankings"),orderBy("points","desc"),limit(50)));
    const rows=snap.docs.map(d=>({id:d.id,...d.data()})).slice(0,10);
    if(!rows.length){$("rankingList").innerHTML=`<div class="empty">Chưa có dữ liệu xếp hạng. Cloud Functions có thể cập nhật collection này.</div>`;return;}
    $("rankingList").innerHTML=rows.map((r,i)=>`
      <div class="rank-row ${i<3?"top-rank":""}">
        <div class="rank-num">${["🥇","🥈","🥉"][i]||`#${i+1}`}</div>
        <div class="avatar">${esc(initials(r.displayName||r.name||"H"))}</div>
        <div><strong>${esc(r.displayName||r.name||"Học sinh")}</strong><small>${esc(roleNames[r.role]||r.role||"Học sinh")}</small></div>
        <strong>${Number(r.points||0)} điểm</strong><span>✅ ${Number(r.completedCount||r.tasksCompleted||0)} nhiệm vụ</span>
      </div>`).join("");
    $("topBadges").innerHTML=rows.slice(0,3).map((r,i)=>`<div class="badge-card"><span>${["🥇","🥈","🥉"][i]}</span><b>${esc(r.displayName||r.name||"Học sinh")}</b><small>Chiến binh xuất sắc · Top ${i+1}</small></div>`).join("");
  } catch(err) {
    $("rankingList").innerHTML=`<div class="empty error">Không thể tải bảng xếp hạng: ${esc(err.message)}</div>`;
  }
}

function renderProfile() {
  const name=profile.displayName||currentUser.displayName||"Học sinh";
  const content=`
    <section class="profile-grid">
      <div class="card profile-card">
        <div class="big-avatar">${esc(initials(name))}</div>
        <h2>${esc(name)}</h2><span class="role-badge">${esc(roleNames[role]||role)}</span>
        <p class="muted">📧 ${esc(profile.email||currentUser.email||"")}</p>
        <p class="muted">🏫 Lớp ${esc(profile.className||"Chưa cập nhật")}</p>
        <button class="secondary" id="editProfile">✏️ Chỉnh sửa hồ sơ</button>
      </div>
      <div class="card">
        <h2>📊 Thống kê</h2>
        <div class="stats profile-stats">
          <div class="stat-card"><strong>${Number(profile.points||0)}</strong><span>Tổng điểm</span></div>
          <div class="stat-card"><strong>${Number(profile.weeklyPoints||0)}</strong><span>Điểm tuần</span></div>
          <div class="stat-card"><strong>${Number(profile.completedCount||0)}</strong><span>N.vụ hoàn thành</span></div>
          <div class="stat-card"><strong>${Number(profile.postCount||0)}</strong><span>Bài đăng</span></div>
        </div>
      </div>
    </section>
    <section class="card"><h2>🏅 Huy hiệu đặc biệt</h2><div class="achievement">🏅 <b>Chiến binh xuất sắc</b><span>Được cấp theo kết quả bảng vàng</span></div></section>
    <section class="card"><h2>📈 Lịch sử thăng cấp</h2><div id="levelHistory" class="timeline">${renderHistory(profile.levelHistory)}</div></section>
    <section class="card profile-actions"><button class="secondary" id="changePassword">🔑 Đổi mật khẩu</button><button class="danger" id="logoutProfile">🚪 Đăng xuất</button></section>`;
  shell("Hồ sơ","Thông tin và thành tích của bạn",content);
  $("editProfile").onclick=()=>openProfileModal();
  $("changePassword").onclick=()=>openPasswordModal();
  $("logoutProfile").onclick=()=>signOut(auth);
}
function renderHistory(h) {
  if(!Array.isArray(h)||!h.length) return `<div class="empty">Chưa có lịch sử thăng cấp.</div>`;
  return h.map(x=>`<div class="timeline-item"><b>${esc(fmtDate(x.date))}</b><span>Level ${esc(x.from)} → Level ${esc(x.to)} ${esc(x.reason||"")}</span></div>`).join("");
}

async function renderAdmin() {
  if(!isManager()){ location.replace("index.html"); return; }
  const content=`
    <section class="admin-grid">
      <div class="card"><h2>👥 Quản lý người dùng</h2><div id="userTable"><div class="empty">Đang tải...</div></div></div>
      <div class="card"><h2>📊 Thống kê tổng thể</h2><div id="adminStats" class="stats"></div></div>
    </section>
    <section class="card"><h2>⚙️ Cài đặt hệ thống</h2>
      <form id="settingsForm" class="settings-grid">
        <label>Điểm đúng hạn<input id="onTimePoints" type="number" min="0" value="10"></label>
        <label>Điểm trễ hạn<input id="latePoints" type="number" min="0" value="5"></label>
        <label>Giới hạn task chung/ngày<input id="sharedLimit" type="number" min="0" value="3"></label>
        <button class="primary" type="submit">Lưu cài đặt</button>
        <div id="settingsMsg" class="success"></div>
      </form>
    </section>`;
  shell("Quản trị","Quản lý hệ thống và phân quyền",content);
  await loadAdminData();
}
async function loadAdminData(){
  try{
    const usersSnap=await getDocs(collection(db,"users"));
    const users=usersSnap.docs.map(d=>({id:d.id,...d.data()}));
    $("userTable").innerHTML=`<div class="table-wrap"><table><thead><tr><th>Tên</th><th>Email</th><th>Role</th><th>Điểm</th><th>Thao tác</th></tr></thead><tbody>
      ${users.map(u=>`<tr><td>${esc(u.displayName||"Học sinh")}</td><td>${esc(u.email||"")}</td><td><span class="role-badge">${esc(roleNames[u.role]||u.role||"user")}</span></td><td>${Number(u.points||0)}</td>
      <td>${isAdmin() && u.id!==currentUser.uid ? `<select data-role="${esc(u.id)}"><option value="user" ${u.role==="user"?"selected":""}>User</option><option value="moderator" ${u.role==="moderator"?"selected":""}>Moderator</option><option value="assistant" ${u.role==="assistant"?"selected":""}>Assistant</option><option value="admin" ${u.role==="admin"?"selected":""}>Admin</option></select>` : "—"}</td></tr>`).join("")}
    </tbody></table></div>`;
    $("adminStats").innerHTML=`<div class="stat-card"><strong>${users.length}</strong><span>Tổng user</span></div><div class="stat-card"><strong>${tasks.filter(t=>completions.has(t.id)).length}</strong><span>Task tôi hoàn</span></div><div class="stat-card"><strong>${users.reduce((a,u)=>a+Number(u.completedCount||0),0)}</strong><span>Lượt hoàn thành</span></div>`;
    document.querySelectorAll("[data-role]").forEach(sel=>sel.onchange=async()=> {
      try { await updateDoc(doc(db,"users",sel.dataset.role),{role:sel.value}); alert("Đã cập nhật role trong hồ sơ. Custom Claims vẫn cần được đồng bộ để quyền Firestore có hiệu lực."); }
      catch(err){ alert(err.message); }
    });
    const setSnap=await getDoc(doc(db,"system_settings","main"));
    if(setSnap.exists()){const s=setSnap.data();$("onTimePoints").value=s.onTimePoints??10;$("latePoints").value=s.latePoints??5;$("sharedLimit").value=s.sharedLimit??3;}
    $("settingsForm").onsubmit=async e=>{
      e.preventDefault();
      if(!isAdmin()){showMessage($("settingsMsg"),"Chỉ Admin mới được lưu cài đặt.");return;}
      try{await setDoc(doc(db,"system_settings","main"),{onTimePoints:Number($("onTimePoints").value),latePoints:Number($("latePoints").value),sharedLimit:Number($("sharedLimit").value),updatedAt:serverTimestamp()},{merge:true});showMessage($("settingsMsg"),"Đã lưu cài đặt.",true);}
      catch(err){showMessage($("settingsMsg"),err.message);}
    };
  }catch(err){$("userTable").innerHTML=`<div class="empty error">Không thể tải dữ liệu quản trị: ${esc(err.message)}</div>`;}
}

function openTaskModal(){
  $("modalRoot").innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><div class="modal"><div class="modal-head"><h2>＋ Tạo nhiệm vụ mới</h2><button id="closeModal">×</button></div>
    <form id="taskForm" class="modal-form">
      <label>Tiêu đề<input id="taskTitle" required maxlength="120" placeholder="Ví dụ: Làm bài tập Toán trang 15–20"></label>
      <label>Mô tả<textarea id="taskDescription" maxlength="500" placeholder="Mô tả ngắn về nhiệm vụ"></textarea></label>
      <div class="two"><label>Môn học<select id="taskSubject"><option value="">Chọn môn</option>${Object.keys(subjects).map(s=>`<option>${s}</option>`).join("")}</select></label>
      <label>Hạn nộp<input id="taskDeadline" type="datetime-local"></label></div>
      <div class="two"><label>Ưu tiên<select id="taskPriority"><option value="low">Thấp</option><option value="medium" selected>Vừa</option><option value="high">Cao</option></select></label>
      <label>Loại nhiệm vụ<select id="taskVisibility"><option value="shared">📌 Chung — mọi người cùng hoàn thành</option><option value="public">🌐 Công khai — mọi người có thể tham gia</option><option value="private">🔒 Riêng tư — chỉ tôi</option></select></label></div>
      <div id="taskError" class="error"></div><button class="primary wide">Tạo nhiệm vụ</button>
    </form></div></div>`;
  $("closeModal").onclick=closeModal;
  $("modalBackdrop").onclick=e=>{if(e.target.id==="modalBackdrop")closeModal()};
  $("taskForm").onsubmit=async e=>{
    e.preventDefault(); showMessage($("taskError"),"");
    try{
      const deadline=$("taskDeadline").value ? new Date($("taskDeadline").value) : null;
      await addDoc(collection(db,"tasks"),{
        title:$("taskTitle").value.trim(),description:$("taskDescription").value.trim(),
        subject:$("taskSubject").value,deadline,priority:$("taskPriority").value,
        visibility:$("taskVisibility").value,ownerId:currentUser.uid,
        ownerName:profile.displayName||currentUser.displayName||"Học sinh",createdAt:serverTimestamp()
      });
      closeModal();
    }catch(err){showMessage($("taskError"),err.message||"Không thể tạo nhiệm vụ.");}
  };
}
function closeModal(){if($("modalRoot"))$("modalRoot").innerHTML="";}

function openProfileModal(){
  $("modalRoot").innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><div class="modal"><div class="modal-head"><h2>✏️ Chỉnh sửa hồ sơ</h2><button id="closeModal">×</button></div>
  <form id="profileForm" class="modal-form"><label>Họ tên<input id="editName" required value="${esc(profile.displayName||"")}"></label>
  <label>Lớp học<select id="editClass">${["10T1","10T2","10T3","11T1","11T2","11T3","12T1","12T2","12T3"].map(x=>`<option ${x===profile.className?"selected":""}>${x}</option>`).join("")}</select></label>
  <div id="profileMsg" class="error"></div><button class="primary wide">Lưu thay đổi</button></form></div></div>`;
  $("closeModal").onclick=closeModal;
  $("profileForm").onsubmit=async e=>{e.preventDefault();try{const name=$("editName").value.trim();const cls=$("editClass").value;await updateProfile(currentUser,{displayName:name});await updateDoc(doc(db,"users",currentUser.uid),{displayName:name,className:cls});await loadProfile();closeModal();renderProfile();}catch(err){showMessage($("profileMsg"),err.message);}};
}
function openPasswordModal(){
  $("modalRoot").innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><div class="modal"><div class="modal-head"><h2>🔑 Đổi mật khẩu</h2><button id="closeModal">×</button></div>
  <form id="passwordForm" class="modal-form"><label>Mật khẩu hiện tại<input id="oldPass" type="password" required></label><label>Mật khẩu mới<input id="newPass" type="password" minlength="6" required></label><label>Xác nhận mật khẩu<input id="newPass2" type="password" minlength="6" required></label><div id="passwordMsg" class="error"></div><button class="primary wide">Đổi mật khẩu</button></form></div></div>`;
  $("closeModal").onclick=closeModal;
  $("passwordForm").onsubmit=async e=>{e.preventDefault();if($("newPass").value!==$("newPass2").value){showMessage($("passwordMsg"),"Mật khẩu xác nhận không khớp.");return;}
    try{const cred=EmailAuthProvider.credential(currentUser.email,$("oldPass").value);await reauthenticateWithCredential(currentUser,cred);await updatePassword(currentUser,$("newPass").value);closeModal();alert("Đã đổi mật khẩu.");}catch(err){showMessage($("passwordMsg"),err.message||"Không thể đổi mật khẩu.");}};
}

function renderCurrentPage(){
  if(!currentUser) return;
  if(page==="index") renderHome();
  else if(page==="community") renderCommunity();
  else if(page==="leaderboard") renderLeaderboard();
  else if(page==="profile") renderProfile();
  else if(page==="admin") renderAdmin();
}

onAuthStateChanged(auth, async user => {
  currentUser=user;
  if(isAuthPage){
    if(user) location.replace("index.html");
    else renderAuth(page==="register"?"register":"login");
    return;
  }
  if(!user){ location.replace("login.html"); return; }
  try {
    await loadProfile();
    if(page==="admin" && !isManager()){location.replace("index.html");return;}
    startTaskListeners();
    renderCurrentPage();
  } catch(err) {
    console.error(err);
    document.body.innerHTML=`<main class="auth-shell"><section class="auth-card"><h2>Không thể tải tài khoản</h2><p class="error">${esc(err.message)}</p><a class="primary inline-btn" href="login.html">Quay lại đăng nhập</a></section></main>`;
  }
});
