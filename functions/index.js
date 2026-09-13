const {onDocumentCreated,onSchedule}=require("firebase-functions/v2/firestore");
const {logger}=require("firebase-functions");
const admin=require("firebase-admin");
admin.initializeApp();
const db=admin.firestore();
const messaging=admin.messaging();

async function allTokens(excludeUids=new Set()){
  const users=await db.collection("users").get();
  const out=[];
  for(const u of users.docs){
    if(excludeUids.has(u.id)) continue;
    const ts=await u.ref.collection("fcmTokens").get();
    for(const t of ts.docs){const token=t.data().token;if(token)out.push({token,ref:t.ref});}
  }
  return out;
}
async function sendAndClean(items,message){
  const stale=[];
  for(let i=0;i<items.length;i+=500){
    const batch=items.slice(i,i+500);
    const res=await messaging.sendEachForMulticast({tokens:batch.map(x=>x.token),...message});
    res.responses.forEach((r,j)=>{if(!r.success && ["messaging/registration-token-not-registered","messaging/invalid-registration-token"].includes(r.error?.code)) stale.push(batch[j].ref);});
  }
  if(stale.length)await Promise.all(stale.map(r=>r.delete()));
}

exports.notifyNewTask=onDocumentCreated("tasks/{taskId}",async event=>{
  const task=event.data?.data(); if(!task)return;
  const excluded=new Set(task.completedBy||[]);
  const items=await allTokens(excluded); if(!items.length)return;
  const title=`📚 Nhiệm vụ mới · ${task.subject||"SchoolTask"}`;
  const body=`${task.taskContent||"Có nhiệm vụ mới"}${task.deadline?` · Hạn ${new Date(task.deadline).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}`:""}`;
  await sendAndClean(items,{notification:{title,body},data:{title,body,taskId:event.params.taskId,url:"./",tag:`new-${event.params.taskId}`}});
});

exports.notifyDeadlines=onSchedule({schedule:"every 5 minutes",timeZone:"Asia/Ho_Chi_Minh"},async()=>{
  const now=Date.now();
  const tasks=await db.collection("tasks").where("deadline",">=",new Date(now-90*60000).toISOString()).where("deadline","<=",new Date(now+25*60*60000).toISOString()).get();
  for(const d of tasks.docs){
    const t=d.data(); if(!t.deadline)continue;
    const ms=new Date(t.deadline).getTime()-now;
    const kind=Math.abs(ms-24*3600000)<=7*60000?"24h":Math.abs(ms-3600000)<=7*60000?"1h":null;
    if(!kind)continue;
    const key=`${kind}Notified`; if(t[key])continue;
    await d.ref.update({[key]:true});
    const excluded=new Set(t.completedBy||[]); const items=await allTokens(excluded); if(!items.length)continue;
    const body=`${t.taskContent||"Nhiệm vụ"} · ${kind==="1h"?"còn khoảng 1 giờ":"còn khoảng 24 giờ"}`;
    await sendAndClean(items,{notification:{title:`⏰ Nhắc hạn · ${t.subject||"SchoolTask"}`,body},data:{title:"⏰ SchoolTask",body,taskId:d.id,url:"./",tag:`deadline-${d.id}-${kind}`}});
  }
  logger.info("Deadline notifications checked");
});
