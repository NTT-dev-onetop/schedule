importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBp4Iht5dmKnhU9_bg8Q8R1sfeSpH8STq8",
  authDomain: "t1-myschedule.firebaseapp.com",
  projectId: "t1-myschedule",
  storageBucket: "t1-myschedule.firebasestorage.app",
  messagingSenderId: "426393869723",
  appId: "1:426393869723:web:db2dc3ce7b02cb3e24953e"
});

const messaging=firebase.messaging();
messaging.onBackgroundMessage(payload=>{
  const n=payload.notification||{},d=payload.data||{};
  const title=n.title||"🔔 SchoolTask";
  const body=n.body||"Bạn có nhiệm vụ cần chú ý.";
  self.registration.showNotification(title,{
    body,
    icon:"./img/tải xuống.png",
    badge:"./img/tải xuống.png",
    tag:d.taskId?`schooltask-${d.taskId}-${d.kind||"reminder"}`:"schooltask-notification",
    renotify:true,
    data:{taskId:d.taskId||""}
  });
});

self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const taskId=event.notification.data?.taskId||"";
 const url=new URL("./index.html",self.location.origin);
 if(taskId)url.searchParams.set("task",taskId);
 event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
   for(const client of list){if("focus" in client)return client.focus().then(()=>client.navigate(url.href));}
   return clients.openWindow(url.href);
 }));
});
