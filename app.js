const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const twilio = require('twilio');
const cron = require('node-cron');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use('/audio', express.static(path.join(__dirname, 'public')));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// AAPKA EXISTING VARIABLE
const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER.startsWith('whatsapp')? process.env.TWILIO_PHONE_NUMBER : `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;

const REMINDER_FILE = path.join(__dirname, 'reminders.json');
if(!fs.existsSync(REMINDER_FILE)) fs.writeFileSync(REMINDER_FILE, JSON.stringify([]));

async function parseReminder(userText){
  try{
    const model = genAI.getGenerativeModel({model:"gemini-flash-latest"});
    const now = new Date().toLocaleString("en-IN", {timeZone: "Asia/Kolkata"});
    const prompt = `Current Ahmedabad time: ${now} Asia/Kolkata. User: "${userText}". If this is reminder (birthday, anniversary, meeting, call, yaad dilana etc) return ONLY JSON: {"isReminder": true, "task": "Pinky Birthday", "datetime": "2026-12-05T10:00:00+05:30", "repeat": "yearly"} Rules: datetime ISO with +05:30, if year missing use next upcoming date. repeat: once,daily,yearly (birthday/anniversary = yearly). If not reminder return {"isReminder": false}. ONLY JSON.`;
    const result = await model.generateContent(prompt);
    let txt = result.response.text().replace(/```json|```/g,'').trim();
    return JSON.parse(txt);
  }catch(e){ console.log("Parse error", e.message); return {isReminder:false}; }
}

function saveReminder(data){
  let all = JSON.parse(fs.readFileSync(REMINDER_FILE));
  all.push({...data, id: Date.now(), sent: false});
  fs.writeFileSync(REMINDER_FILE, JSON.stringify(all, null, 2));
}

app.get('/', (req,res)=> res.send('Jarvis Real Reminder Online Boss!') );

app.post('/webhook', async (req,res)=>{
  const from = req.body.From;
  const to = req.body.To;
  let finalText = req.body.Body || "";
  let isVoice = false;
  const mediaUrl = req.body.MediaUrl0;
  const mediaType = req.body.MediaContentType0;

  if(mediaUrl && mediaType && mediaType.includes('audio')){
    try{
      const audioRes = await axios.get(mediaUrl, { responseType:'arraybuffer', auth:{ username: process.env.TWILIO_ACCOUNT_SID, password: process.env.TWILIO_AUTH_TOKEN } });
      const model = genAI.getGenerativeModel({model:"gemini-flash-latest"});
      const r = await model.generateContent([{ inlineData:{ data: Buffer.from(audioRes.data).toString('base64'), mimeType: mediaType }}, {text:"Transcribe Hindi/English exactly"}]);
      finalText = r.response.text();
      isVoice = true;
    }catch(e){ console.log("Voice error", e.message); }
  }

  if(!finalText) finalText = "Hi";

  const parsed = await parseReminder(finalText);
  let jarvisReply = "";

  if(parsed.isReminder){
    saveReminder({ task: parsed.task, datetime: parsed.datetime, repeat: parsed.repeat, user: from });
    const dt = new Date(parsed.datetime).toLocaleString("en-IN", {timeZone:"Asia/Kolkata", day:'numeric', month:'long', year:'numeric', hour:'numeric', minute:'numeric', hour12:true});
    jarvisReply = `Done Boss! ✅\n\nReminder set: *${parsed.task}*\nOn: ${dt}\nRepeat: ${parsed.repeat}\n\nMain pakka yaad dilaunga!`;
  } else {
    try{
      const model = genAI.getGenerativeModel({model:"gemini-flash-latest"});
      const r = await model.generateContent(`You are Jarvis, friendly assistant for Boss in Ahmedabad. Reply short Hindi+English mix, call him Boss. User: ${finalText}`);
      jarvisReply = r.response.text();
    }catch(e){ jarvisReply = "Boss thoda error aaya, phir se bolo!"; console.log(e.message); }
  }

  if(isVoice && process.env.ELEVENLABS_API_KEY){
    try{
      if(!fs.existsSync('public')) fs.mkdirSync('public');
      const fileName = `jarvis_${Date.now()}.mp3`;
      const filePath = path.join(__dirname, 'public', fileName);
      const ttsRes = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`, {text: jarvisReply, model_id:"eleven_multilingual_v2"}, {headers:{"xi-api-key":process.env.ELEVENLABS_API_KEY}, responseType:'arraybuffer'});
      fs.writeFileSync(filePath, ttsRes.data);
      const audioUrl = `https://${req.get('host')}/audio/${fileName}`;
      await client.messages.create({from: to, to: from, body: jarvisReply, mediaUrl:[audioUrl]});
      setTimeout(()=> fs.existsSync(filePath) && fs.unlinkSync(filePath), 120000);
      return res.send('<Response></Response>');
    }catch(e){ console.log("TTS Error", e.message); }
  }

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(jarvisReply);
  res.type('text/xml').send(twiml.toString());
});

cron.schedule('* * * * *', async ()=>{
  try{
    let all = JSON.parse(fs.readFileSync(REMINDER_FILE));
    const now = new Date();
    for(let rem of all){
      if(rem.sent) continue;
      if(now >= new Date(rem.datetime)){
        console.log("Sending reminder:", rem.task);
        await client.messages.create({ from: FROM_NUMBER, to: rem.user, body: `🔔 REMINDER BOSS! 🔔\n\n*${rem.task}*\nTime: ${new Date(rem.datetime).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}\n\nYaad dila diya Boss!` });
        rem.sent = true;
        if(rem.repeat === 'yearly'){
          let next = new Date(rem.datetime); next.setFullYear(next.getFullYear()+1);
          all.push({...rem, id: Date.now()+Math.random(), datetime: next.toISOString(), sent:false});
        }
      }
    }
    fs.writeFileSync(REMINDER_FILE, JSON.stringify(all, null, 2));
  }catch(e){ console.log("Cron error", e.message); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Jarvis ON '+PORT));
