import {
  onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile, signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
  collection, doc, getDoc, setDoc, addDoc, onSnapshot,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

import { auth, db, googleProvider } from "./firebase-config.js";

const $ = id => document.getElementById(id);
let authMode = "login";
let currentUser = null;
let profile = null;
let tasks = [];

const roleNames = {
  user: "Học sinh",
  moderator: "Moderator",
  assistant: "Assistant Admin",
  admin: "Admin"
};

function initials(name = "H") {
  return name.trim().charAt(0).toUpperCase() || "H";
}

function showError(message) {
  $("authError").textContent = message || "";
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll(".register-only").forEach(el => el.classList.toggle("hidden", mode !== "register"));
  $("authSubmit").textContent = mode === "login" ? "Đăng nhập" : "Tạo tài khoản";
  $("modeBtn").textContent = mode === "login"
    ? "Chưa có tài khoản? Đăng ký"
    : "Đã có tài khoản? Đăng nhập";
  showError("");
}

$("modeBtn").onclick = () => setAuthMode(authMode === "login" ? "register" : "login");

$("authForm").onsubmit = async e => {
  e.preventDefault();
  showError("");
  const email = $("emailInput").value.trim();
  const password = $("passwordInput").value;
  const name = $("nameInput").value.trim();

  try {
    if (authMode === "login") {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        displayName: name || "Học sinh",
        email,
        role: "user",
        points: 0,
        completedCount: 0,
        createdAt: serverTimestamp()
      }, { merge: true });
    }
  } catch (err) {
    showError(err.message || "Có lỗi xảy ra.");
  }
};

$("googleBtn").onclick = async () => {
  showError("");
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      displayName: cred.user.displayName || "Học sinh",
      email: cred.user.email || "",
      role: "user",
      points: 0,
      completedCount: 0,
      createdAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    showError(err.message || "Google Sign-In thất bại.");
  }
};

$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (!user) {
    $("authView").classList.remove("hidden");
    $("appView").classList.add("hidden");
    return;
  }

  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");

  const snap = await getDoc(doc(db, "users", user.uid));
  profile = snap.exists() ? snap.data() : {
    displayName: user.displayName || "Học sinh",
    email: user.email || "",
    role: "user",
    points: 0,
    completedCount: 0
  };

  renderProfile();
  startTasksListener();
});

function renderProfile() {
  const name = profile.displayName || currentUser.displayName || "Học sinh";
  const role = profile.role || "user";
  $("sideName").textContent = name;
  $("sideRole").textContent = roleNames[role] || role;
  $("avatar").textContent = initials(name);
  $("profileAvatar").textContent = initials(name);
  $("profileName").textContent = name;
  $("profileEmail").textContent = profile.email || currentUser.email || "";
  $("profileRole").textContent = roleNames[role] || role;
  $("profilePoints").textContent = profile.points || 0;
  $("profileCompleted").textContent = profile.completedCount || 0;
  $("myPoints").textContent = profile.points || 0;

  const canManage = ["moderator", "assistant", "admin"].includes(role);
  $("adminNav").classList.toggle("hidden", !canManage);
}

function startTasksListener() {
  const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTasks();
  }, err => console.error(err));
}

function dateText(value) {
  if (!value) return "Chưa đặt";
  const d = value.toDate ? value.toDate() : new Date(value);
  return d.toLocaleDateString("vi-VN");
}

function taskCard(task) {
  const visibility = task.visibility || "shared";
  if (visibility === "private" && task.ownerId !== currentUser.uid) return "";

  const label = visibility === "shared" ? "Chia sẻ" : visibility === "public" ? "Công khai" : "Riêng tư";
  const canComplete = visibility === "shared" || task.ownerId === currentUser.uid;

  return `
    <article class="task-card">
      <div class="task-top">
        <span class="badge ${visibility}">${label}</span>
        <span class="priority">${task.priority || "medium"}</span>
      </div>
      <h3>${escapeHtml(task.title || "Không có tên")}</h3>
      <p>${escapeHtml(task.description || "")}</p>
      <div class="task-meta">
        <span>${escapeHtml(task.subject || "Không có môn")}</span>
        <span>Hạn: ${dateText(task.deadline)}</span>
      </div>
      <div class="task-foot">
        <small class="muted">bởi ${escapeHtml(task.ownerName || "Học sinh")}</small>
        ${canComplete ? `<button class="complete" data-complete="${task.id}">✓ Hoàn thành</button>` : ""}
      </div>
    </article>`;
}

function renderTasks() {
  const mine = tasks.filter(t => t.ownerId === currentUser.uid);
  const community = tasks.filter(t => t.visibility !== "private");
  $("myTaskCount").textContent = mine.length;
  $("communityCount").textContent = community.length;
  $("homeTasks").innerHTML = tasks.slice(0, 6).map(taskCard).join("") || emptyState("Chưa có nhiệm vụ.");
  $("communityTasks").innerHTML = community.map(taskCard).join("") || emptyState("Cộng đồng chưa có nhiệm vụ.");

  document.querySelectorAll("[data-complete]").forEach(btn => {
    btn.onclick = () => completeTask(btn.dataset.complete);
  });
}

function emptyState(text) {
  return `<div class="card"><p class="muted">${text}</p></div>`;
}

async function completeTask(taskId) {
  // MVP: ghi completion document. Điểm số thật nên do Cloud Function tính,
  // để người dùng không thể tự cộng điểm.
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const completionId = `${taskId}_${currentUser.uid}`;
  try {
    await setDoc(doc(db, "task_completions", completionId), {
      taskId,
      uid: currentUser.uid,
      completedAt: serverTimestamp()
    }, { merge: false });
    alert("Đã ghi nhận hoàn thành. Điểm sẽ do hệ thống tính.");
  } catch (err) {
    alert(err.message || "Không thể hoàn thành.");
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.onclick = () => {
    const page = btn.dataset.page;
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    $("page-" + page).classList.remove("hidden");
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    $("pageTitle").textContent = {
      home: "Tổng quan", community: "Cộng đồng",
      ranking: "Xếp hạng", profile: "Hồ sơ", admin: "Quản trị"
    }[page];
    if (page === "ranking") renderRanking();
  };
});

function renderRanking() {
  $("rankingList").innerHTML = `
    <div class="rank-row">
      <b>—</b><div class="avatar">?</div>
      <strong>Đang chờ Cloud Functions</strong><span>0 điểm</span>
    </div>`;
}

$("addTaskBtn").onclick = () => $("taskModal").classList.remove("hidden");
$("closeModal").onclick = () => $("taskModal").classList.add("hidden");

$("taskForm").onsubmit = async e => {
  e.preventDefault();
  $("taskError").textContent = "";
  try {
    await addDoc(collection(db, "tasks"), {
      title: $("taskTitle").value.trim(),
      description: $("taskDescription").value.trim(),
      subject: $("taskSubject").value.trim(),
      deadline: $("taskDeadline").value ? new Date($("taskDeadline").value) : null,
      priority: $("taskPriority").value,
      visibility: $("taskVisibility").value,
      ownerId: currentUser.uid,
      ownerName: profile.displayName || currentUser.displayName || "Học sinh",
      createdAt: serverTimestamp()
    });
    $("taskForm").reset();
    $("taskModal").classList.add("hidden");
  } catch (err) {
    $("taskError").textContent = err.message || "Không thể tạo nhiệm vụ.";
  }
};
