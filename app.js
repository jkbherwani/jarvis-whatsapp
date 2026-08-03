const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const cron = require('node-cron');
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const REM_FILE = './reminders.json';
function loadReminders(){ try{if(fs.existsSync(REM_FILE)) return JSON.parse(fs.readFileSync(REM_FILE));}catch(e){}return[];}
function saveReminders(d){fs.writeFileSync(REM_FILE, JSON.stringify(d,null,2));}
if(!fs.existsSync(REM_FILE)) saveReminders([]);

cron.schedule('* * * * *', async () => {
  const rems = loadReminders(); let changed=false;
  for(let r of rems){ if(r.sent) continue; if(new Date() >= new Date(r.datetime)){
    try{ await client.messages.create({from:FROM_NUMBER,to:r.to,body:`🔔 REMINDER BOSS: ${r.task}`}); r.sent=true; changed=true;}catch(e){console.log(e.message)}
  }}
  if(changed) saveReminders(rems);
});

async function handle(req,res){
  const msg = req.body.Body||''; const from = req.body.From;
  console.log("GOT MSG:",msg,"FROM:",from);
  try{
    let replyText = "";
    const lower = msg.toLowerCase();
    if(lower.includes("minute") && lower.includes("yaad")){
        let m = lower.match(/(\d+)/); let mins = m ? parseInt(m[1]) : 2;
        let d=new Date(); d.setMinutes(d.getMinutes()+mins);
        const rems=loadReminders(); rems.push({to:from, task:msg, datetime:d.toISOString(), sent:false}); saveReminders(rems);
        replyText = `Done Boss! ✅ ${mins} Minute ka Reminder Set!\nTask: ${msg}\nTime: ${d.toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}`;
    } else {
        try{
            const model = genAI.getGenerativeModel({model:"gemini-1.5-flash"});
            const result = await model.generateContent(`You are JARVIS. Reply Hinglish short. User: ${msg}`);
            replyText = result.response.text();
        }catch(e){
            console.log("Gemini Fail:", e.message);
            replyText = `Hi Boss! ON hu ✅ (Gemini error: ${e.message.slice(0,80)})`;
        }
    }
    await client.messages.create({from:FROM_NUMBER, to:from, body:replyText});
    console.log("REPLY SENT");
  }catch(e){console.log("MAIN ERROR", e.message)}
  res.sendStatus(200);
}

app.post('/whatsapp', handle);
app.post('/webhook', handle);

app.get('/',(req,res)=>res.send('Jarvis ON'));
app.listen(process.env.PORT||10000, ()=>console.log('Jarvis ON'));
