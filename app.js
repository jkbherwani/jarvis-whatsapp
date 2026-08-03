const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const fs = require('fs');
const cron = require('node-cron');
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER;

const REM_FILE = './reminders.json';
function loadReminders(){ try{if(fs.existsSync(REM_FILE)) return JSON.parse(fs.readFileSync(REM_FILE));}catch(e){}return[];}
function saveReminders(d){fs.writeFileSync(REM_FILE, JSON.stringify(d,null,2));}
if(!fs.existsSync(REM_FILE)) saveReminders([]);

cron.schedule('* * * * *', async () => {
  const rems = loadReminders(); let changed=false;
  for(let r of rems){ if(r.sent) continue; if(new Date() >= new Date(r.datetime)){
    try{ await client.messages.create({from:FROM_NUMBER,to:r.to,body:`🔔 REMINDER BOSS! ${r.task} - ${new Date(r.datetime).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}`}); r.sent=true; changed=true;}catch(e){console.log(e)}
  }}
  if(changed) saveReminders(rems);
});

function handle(req,res){
  const msg = (req.body.Body||'').trim();
  const from = req.body.From;
  console.log("GOT:",msg);
  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();
  const lower = msg.toLowerCase();

  if(lower.includes("minute") && (lower.includes("yaad") || lower.includes("reminder"))){
      let m = lower.match(/(\d+)/); let mins = m? parseInt(m[1]) : 2;
      let d=new Date(); d.setMinutes(d.getMinutes()+mins);
      const rems=loadReminders(); rems.push({to:from, task:msg, datetime:d.toISOString(), sent:false}); saveReminders(rems);
      twiml.message(`Done Boss! ✅ ${mins} min ka reminder set!\nTask: ${msg}\nTime: ${d.toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}`);
  } else if(lower.includes("time")){
      twiml.message(`Boss abhi time hua hai: ${new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}`);
  } else if(lower.includes("wether") || lower.includes("weather") || lower.includes("mausam")){
      twiml.message(`Boss aaj Ahmedabad me mausam mast hai! ☀️ 32°C (Main weather API jaldi add karta hu!)`);
  } else {
      twiml.message(`Hi Boss! Main ON hu ✅ Bilkul Mast! Aapne bola: "${msg}"\n\nReminder ke liye bolo: "Mujhe 2 minute baad chai yaad dilana"`);
  }
  res.type('text/xml').send(twiml.toString());
}

app.post('/webhook', handle);
app.post('/whatsapp', handle);
app.get('/',(req,res)=>res.send('Jarvis ON - PCJX LIVE'));
app.listen(process.env.PORT||10000, ()=>console.log('Jarvis PCJX ON'));
