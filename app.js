const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Twilio Setup
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
let FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';
FROM_NUMBER = FROM_NUMBER.trim();
if (!FROM_NUMBER.startsWith('whatsapp:')) {
  FROM_NUMBER = 'whatsapp:' + FROM_NUMBER.replace('whatsapp:', '');
}

// Gemini Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function handleJarvis(req, res) {
  const msg = (req.body.Body || '').trim();
  const from = req.body.From;
  const twiml = new twilio.twiml.MessagingResponse();
  const lower = msg.toLowerCase();

  console.log("Incoming:", msg);

  // 1. REMINDER LOGIC - 100% Working
  if (lower.match(/(\d+)/) && (lower.includes('yaad') || lower.includes('reminder') || lower.includes('chai') || lower.includes('birthday'))) {
    let mins = parseInt(lower.match(/(\d+)/)[1]);
    if (isNaN(mins)) mins = 1;
    if (mins < 1) mins = 1;
    if (mins > 1440) mins = 1440; // max 1 day

    setTimeout(async () => {
      try {
        await client.messages.create({
          from: FROM_NUMBER,
          to: from,
          body: `🔔 REMINDER BOSS! 🔔\n\nTask: ${msg}\nTime: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
        });
        console.log("Reminder Sent");
      } catch (e) { console.log("Reminder Error", e.message); }
    }, mins * 60 * 1000);

    twiml.message(`Done Boss! ✅\n${mins} min me yaad dila dunga: "${msg}"`);
    return res.type('text/xml').send(twiml.toString());
  }

  // 2. GEMINI AI - Stable Free Version
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are Jarvis, a helpful, witty, Hinglish AI assistant. Boss is from Ahmedabad. Keep replies short (2-3 lines), friendly. User says: ${msg}`;
    const result = await model.generateContent(prompt);
    const reply = result.response.text();
    twiml.message(reply);
  } catch (e) {
    console.error("Gemini Error:", e.message);
    twiml.message(`Boss main ON hu! ✅\nAapne bola: "${msg}"\n\nGemini API thoda busy hai, 30 sec baad fir bolo, ho jayega!`);
  }

  res.type('text/xml').send(twiml.toString());
}

app.post('/webhook', handleJarvis);
app.post('/whatsapp', handleJarvis);

app.get('/', (req, res) => {
  res.send('Jarvis FREE LIVE - Gemini 1.5 Flash ✅');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Jarvis LIVE on ${PORT}`));
