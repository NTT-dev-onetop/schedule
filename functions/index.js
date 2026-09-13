const {onSchedule}=require("firebase-functions/v2/scheduler");
const {onDocumentCreated}=require("firebase-functions/v2/firestore");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {getMessaging}=require("firebase-admin/messaging");
initializeApp();
const db=getFirestore();
const messaging=getMessaging();

function taskDate(t){const d=new Date(t.deadline||`${t.date||""}T23:59:00+07:00`);return Number.isNaN(d.getTime())?null:d;}
function title(t,kind){return kind==="24h"?`⏰ Còn 24 giờ: ${t.subject||"Nhiệm vụ"}`:kind==="1h"?`🚨 Còn 1 giờ: ${t.subject||"Nhiệm vụ"}`:`📚 Nhiệm vụ mới: ${t.subject||"Nhiệm vụ"}`;}
function body(t,kind){const d=taskDate(t);const when=d?d.toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"";return `${t.taskContent||"Có nhiệm vụ mới"} · Hạn ${when}`;}

async function sendToEligible(t,kind){
 const snap=await db.collectionGroup("notificationTokens").get();
 const tokens=[];
 snap.forEach(doc=>{const x=doc.data();if(x.token&&x.uid&&!(t.completedBy||[]).includes(x.uid))tokens.push({token:x.token,ref:doc.ref});});
 if(!tokens.length)return;
 const unique=[...new Map(tokens.map(x=>[x.token,x])).values()];
 for(let i=0;i<unique.length;i+=500){
  const batch=unique.slice(i,i+500);
  const res=await messaging.sendEachForMulticast({tokens:batch.map(x=>x.token),notification:{title:title(t,kind),body:body(t,kind)},data:{taskId:t.id,kind},webpush:{notification:{icon:"/img/tải xuống.png",badge:"/img/tải xuống.png",tag:`schooltask-${t.id}-${kind}`,renotify:true},fcmOptions:{link:"/index.html?task="+encodeURIComponent(t.id)}}});
  const deletes=[];res.responses.forEach((r,j)=>{if(!r.success&&["messaging/registration-token-not-registered","messaging/invalid-registration-token"].includes(r.error?.code))deletes.push(batch[j].ref.delete());});
  await Promise.all(deletes);
 }
}

exports.sendNewTaskNotification=onDocumentCreated("tasks/{taskId}",async event=>{
 const snap=event.data;if(!snap)return;const t={id:event.params.taskId,...snap.data()};
 await sendToEligible(t,"new");
});

exports.sendTaskDeadlineReminders=onSchedule({schedule:"every 5 minutes",timeZone:"Asia/Ho_Chi_Minh",memory:"256MiB"},async()=>{
 const now=Date.now(),windowEnd=new Date(now+24*60*60*1000+5*60*1000);
 const snap=await db.collection("tasks").get();
 for(const doc of snap.docs){
  const t={id:doc.id,...doc.data()};if(t.status==="completed")continue;const d=taskDate(t);if(!d)continue;const ms=d.getTime()-now;
  let kind=null;if(ms>=24*60*60*1000&&ms<24*60*60*1000+5*60*1000)kind="24h";else if(ms>=60*60*1000&&ms<60*60*1000+5*60*1000)kind="1h";if(!kind)continue;
  const key=`${t.id}_${kind}`,sent=await db.collection("notificationDispatch").doc(key).get();if(sent.exists)continue;
  await sendToEligible(t,kind);await db.collection("notificationDispatch").doc(key).set({taskId:t.id,kind,sentAt:FieldValue.serverTimestamp()});
 }
});
