const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
let FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';
FROM_NUMBER = FROM_NUMBER.trim();
if (!FROM_NUMBER.startsWith('whatsapp:')) FROM_NUMBER = 'whatsapp:' + FROM_NUMBER.replace('whatsapp:', '');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function handleJarvis(req, res) {
  const msg = (req.body.Body || '').trim();
  const from = req.body.From;
  console.log("IN:", msg);

  const twiml = new twilio.twiml.MessagingResponse();
  const lower = msg.toLowerCase();

  // 1. REMINDER - Bina AI ke direct
  if ((lower.includes('yaad') || lower.includes('reminder')) && lower.match(/\d+/)) {
    let m = lower.match(/(\d+)/);
    let mins = m? parseInt(m[1]) : 2;
    let ms = mins * 60 * 1000;
    let fireTime = new Date(Date.now() + ms);

    setTimeout(async () => {
      try {
        await client.messages.create({
          from: FROM_NUMBER, to: from,
          body: `🔔 REMINDER BOSS! 🔔\nTask: ${msg}\nTime: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
        });
      } catch (e) { console.log("Reminder fail", e.message) }
    }, ms);

    twiml.message(`Done Boss! ✅ ${mins} min ka reminder set! Fire: ${fireTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    return res.type('text/xml').send(twiml.toString());
  }

  // 2. BAAT-CHEET - Gemini AI se
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are JARVIS, a cool Hinglish assistant for Boss. Boss lives in Ahmedabad. Reply short, friendly, in Hinglish (mix Hindi+English). User says: ${msg}`;
    const result = await model.generateContent(prompt);
    const aiReply = result.response.text();
    twiml.message(aiReply);
  } catch (e) {
    console.log("Gemini Error:", e.message);
    // Fallback agar Gemini fail ho jaye
    if (lower.includes('kaise ho')) {
      twiml.message(`Ekdam mast Boss! Aap sunao? 😎 Main toh full charge hu!`);
    } else if (lower.includes('weather') || lower.includes('wether') || lower.includes('mausam')) {
      twiml.message(`Boss Ahmedabad me abhi mausam mast hai! ☀️ 32°C ke aas-paas. Garmi hai thodi!`);
    } else {
      twiml.message(`Hi Boss! Main ON hu ✅ Aapne bola: "${msg}"\nThoda Gemini slow tha, isiliye direct bola!`);
    }
  }

  res.type('text/xml').send(twiml.toString());
}

app.post('/webhook', handleJarvis);
app.post('/whatsapp', handleJarvis);
app.get('/', (req, res) => res.send('Jarvis HYBRID LIVE - AI + Reminder'));
app.listen(process.env.PORT || 10000, () => console.log('HYBRID JARVIS ON'));
