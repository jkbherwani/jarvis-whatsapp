const express = require('express');
const body_parser = require('body-parser');
const axios = require('axios');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express().use(body_parser.json());

// --- 1. DATABASE (Yaad-dasth) ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected - Yaad-dasth ON hai!"))
  .catch(err => console.error("❌ MongoDB Error:", err));

const ReminderSchema = new mongoose.Schema({
  userId: String,
  message: String,
  remindAt: Date,
  sent: { type: Boolean, default: false }
});
const Reminder = mongoose.model('Reminder', ReminderSchema);

// --- 2. BRAIN (Gemini) ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- 3. SCHEDULER (Ghadi) - Har 1 minute check karega ---
cron.schedule('* * * * *', async () => {
  const now = new Date();
  const dueReminders = await Reminder.find({ remindAt: { $lte: now }, sent: false });
  
  for (let rem of dueReminders) {
    console.log(`⏰ Reminder Bhejna hai: ${rem.message}`);
    await sendMessage(rem.userId, `🔔 JAGDISH BOSS, YAAD DILAANA THA!\n\n${rem.message}\n\nTime ho gaya hai Sir!`);
    rem.sent = true;
    await rem.save();
  }
});

async function sendMessage(to, text) {
  await axios({
    method: "POST",
    url: `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`,
    headers: { "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    data: { messaging_product: "whatsapp", to: to, text: { body: text } }
  });
}

// --- WEBHOOKS ---
app.get('/', (req, res) => res.send('JARVIS IS LIVE on 10000 - PRO Version'));
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] == process.env.VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else { res.sendStatus(403); }
});

app.post('/webhook', async (req, res) => {
  let body = req.body;
  if (body.object) {
    let entry = body.entry[0].changes[0].value;
    if (entry.messages) {
      let from = entry.messages[0].from;
      let msg_body = entry.messages[0].text.body;

      // Naya Brain Logic - Date nikalna
      const prompt = `
      You are JARVIS. User said: "${msg_body}"
      Today's date is: ${new Date().toString()}
      Task:
      1. Check if user is asking to remind something.
      2. If yes, extract reminder text and date/time in ISO format.
      3. If user says "2 minute me" -> add 2 minutes to current time.
      4. If user says "10 August ko" -> make it 10 Aug this year 9 AM.
      5. Return ONLY JSON like: {"is_reminder": true, "remind_text": "sona ka time", "remind_at": "2025-08-06T00:32:00.000Z", "reply": "Bilkul Sir..."}
      6. If not a reminder, is_reminder: false and give a stylish JARVIS reply in Hindi/English mix for Jagdish Sir.
      `;

      try {
        const result = await model.generateContent(prompt);
        let text = result.response.text().replace(/```json|```/g, '').trim();
        let data = JSON.parse(text);

        if (data.is_reminder) {
          const newRem = new Reminder({ userId: from, message: data.remind_text, remindAt: new Date(data.remind_at) });
          await newRem.save();
          await sendMessage(from, data.reply);
        } else {
          await sendMessage(from, data.reply || data.response || "Yes Boss?");
        }
      } catch (e) {
        console.error(e);
        await sendMessage(from, "Thoda network issue hai Boss, fir se bolo?");
      }
    }
    res.sendStatus(200);
  } else { res.sendStatus(404); }
});

app.listen(process.env.PORT || 10000, () => console.log('🚀 JARVIS PRO LIVE on 10000'));
