// FINAL JARVIS PRO V3 - BUG FREE
const express = require('express');
const body_parser = require('body-parser');
const axios = require('axios');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express().use(body_parser.json());

mongoose.connect(process.env.MONGODB_URI)
 .then(() => console.log("✅ MongoDB Connected"))
 .catch(err => console.error("❌ MongoDB Error:", err));

const ReminderSchema = new mongoose.Schema({
  userId: String, message: String, remindAt: Date, sent: { type: Boolean, default: false }
});
const Reminder = mongoose.model('Reminder', ReminderSchema);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

cron.schedule('* * * * *', async () => {
  const now = new Date();
  const due = await Reminder.find({ remindAt: { $lte: now }, sent: false });
  for (let r of due) {
    await sendMessage(r.userId, `🔔 JAGDISH BOSS, YAAD DILAANA THA!\n\n${r.message}`);
    r.sent = true; await r.save();
  }
});

async function sendMessage(to, text) {
  await axios({ method: "POST", url: `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`, headers: { "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" }, data: { messaging_product: "whatsapp", to: to, text: { body: text } } });
}

app.get('/', (req, res) => res.send('JARVIS V3 LIVE'));
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] == process.env.VERIFY_TOKEN) res.send(req.query['hub.challenge']);
  else res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  try {
    let body = req.body;
    if (body.object) {
      let entry = body.entry?.[0]?.changes?.[0]?.value;
      if (!entry?.messages) { res.sendStatus(200); return; }

      let msgObj = entry.messages[0];
      if (!msgObj.text) { console.log("Ignoring non-text"); res.sendStatus(200); return; }

      let from = msgObj.from;
      let msg_body = msgObj.text.body;
      console.log("User:", msg_body);

      const prompt = `You are JARVIS for Jagdish Sir. User said: "${msg_body}". Current time: ${new Date().toString()}. If it's a reminder, return JSON: {"is_reminder": true, "remind_text": "...", "remind_at": "ISO DATE", "reply": "Haan Sir set kar diya..."}. If user says 1 minute baad, add 1 min. If not reminder, return JSON: {"is_reminder": false, "reply": "stylish hinglish reply"}. Return ONLY JSON.`;

      const result = await model.generateContent(prompt);
      let text = result.response.text().replace(/```json|```/g, '').trim();
      console.log("Gemini:", text);
      let jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      let data = JSON.parse(jsonMatch[0]);

      if (data.is_reminder) {
        await new Reminder({ userId: from, message: data.remind_text, remindAt: new Date(data.remind_at) }).save();
        await sendMessage(from, data.reply);
      } else {
        await sendMessage(from, data.reply);
      }
    }
    res.sendStatus(200);
  } catch (e) {
    console.error("ERROR:", e.message);
    res.sendStatus(200);
  }
});

app.listen(process.env.PORT || 10000, () => console.log('🚀 JARVIS PRO V3 LIVE on 10000'));
