const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const cron = require('node-cron');
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER.startsWith('whatsapp:') ? process.env.TWILIO_PHONE_NUMBER : `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const REM_FILE = './reminders.json';
function loadReminders(){ try{if(fs.existsSync(REM_FILE))return JSON.parse(fs.readFileSync(REM_FILE));}catch(e){}return[]; }
function saveReminders(d){ fs.writeFileSync(REM_FILE, JSON.stringify(d,null,2)); }
if(!fs.existsSync(REM_FILE)) saveReminders([]);

cron.schedule('* * * * *', async () => {
  const rems = loadReminders(); let changed=false; const now=new Date();
  for(let r of rems){ if(r.sent)continue; if(now >= new Date(r.datetime)){
    try{ await client.messages.create({from:FROM_NUMBER,to:r.to,body:`🔔 REMINDER BOSS! 🔔\n*${r.task}*\n\nTime: ${new Date(r.datetime).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}`}); r.sent=true; changed=true; }catch(e){console.log(e.message)}
  }}
  if(changed) saveReminders(rems);
});

app.post('/whatsapp', async (req,res)=>{
  const msg = (req.body.Body||'').trim();
  const from = req.body.From;
  console.log("IN:",msg);
  try{
    // ---- SMART PARSER WITHOUT AI ----
    let task=null, date=null, isRem=false;
    const lower = msg.toLowerCase();
    if(lower.includes('yaad dila') || lower.includes('reminder') || lower.includes('yaad kara')){
        isRem=true;
        const minMatch = lower.match(/(\d+)\s*minute\s*baad/);
        if(minMatch){
            let m = parseInt(minMatch[1]);
            let d = new Date(); d.setMinutes(d.getMinutes()+m);
            date=d.toISOString(); task=msg;
        } else if(lower.includes('5 december') || lower.includes('5 dec')){
            let d = new Date(); d.setMonth(11); d.setDate(5); d.setHours(10,0,0,0);
            if(d < new Date()) d.setFullYear(d.getFullYear()+1);
            date=d.toISOString(); task=msg;
        }
    }
    if(isRem && date){
        const rems=loadReminders();
        rems.push({to:from, task:task, datetime:date, sent:false});
        saveReminders(rems);
        await client.messages.create({from:FROM_NUMBER,to:from,body:`Done Boss! ✅ Reminder Set!\n📌 Task: *${task}*\n⏰ On: ${new Date(date).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}\n\nPakka yaad dilaunga!`});
        return res.sendStatus(200);
    }
    // ---- NORMAL CHAT WITH GEMINI ----
    try{
        const model = genAI.getGenerativeModel({model:"gemini-pro"});
        const result = await model.generateContent(`You are JARVIS. Reply short Hinglish. User: ${msg}`);
        const reply = result.response.text();
        await client.messages.create({from:FROM_NUMBER,to:from,body:reply});
    }catch(e){
        console.log("Gemini error:",e.message);
        await client.messages.create({from:FROM_NUMBER,to:from,body:`Hi Boss! Main ON hu! ✅\nReminders ke liye bolo: "Mujhe 2 minute baad chai yaad dilana"`});
    }
    res.sendStatus(200);
  }catch(e){ console.log(e); res.sendStatus(200); }
});

app.get('/',(req,res)=>res.send('Jarvis ON'));
app.listen(process.env.PORT||10000,()=>console.log('Jarvis ON'));
