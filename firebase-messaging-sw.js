importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBp4Iht5dmkHNVu9_bgQ8R1sfeSpH8STq8",
  authDomain: "t1-myschedule.firebaseapp.com",
  projectId: "t1-myschedule",
  storageBucket: "t1-myschedule.firebasestorage.app",
  messagingSenderId: "426393869723",
  appId: "1:426393869723:web:db2dc3ce7b02cb3e24953e",
  measurementId: "G-M09P6LRX1M"
});
const messaging=firebase.messaging();
messaging.onBackgroundMessage(payload=>{
  const n=payload.notification||{};
  const d=payload.data||{};
  const title=n.title||d.title||"🔔 SchoolTask";
  const body=n.body||d.body||"Bạn có thông báo mới.";
  self.registration.showNotification(title,{
    body,
    icon:"./img/tải xuống.png",
    badge:"./img/tải xuống.png",
    tag:d.tag||"schooltask",
    renotify:true,
    data:{url:d.url||"./",taskId:d.taskId||""}
  });
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const url=new URL(event.notification.data?.url||"./",self.location.origin).href;
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const client of list){if("focus" in client){client.navigate(url);return client.focus();}}
    return clients.openWindow(url);
  }));
});
