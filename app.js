const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const fs = require('fs');
const cron = require('node-cron');
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER.startsWith('whatsapp:') ? process.env.TWILIO_PHONE_NUMBER : `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

const REM_FILE = './reminders.json';
function loadReminders() { try { if (fs.existsSync(REM_FILE)) return JSON.parse(fs.readFileSync(REM_FILE)); } catch(e){} return []; }
function saveReminders(data) { fs.writeFileSync(REM_FILE, JSON.stringify(data, null, 2)); }
if (!fs.existsSync(REM_FILE)) saveReminders([]);

// Check reminders every minute
cron.schedule('* * * * *', async () => {
    const reminders = loadReminders();
    const now = new Date();
    let changed = false;
    for (let rem of reminders) {
        if (rem.sent) continue;
        const remTime = new Date(rem.datetime);
        if (now >= remTime) {
            try {
                await client.messages.create({ from: FROM_NUMBER, to: rem.to, body: `🔔 REMINDER BOSS! 🔔\n*${rem.task}*\nTime: ${remTime.toLocaleString('en-IN', {timeZone:'Asia/Kolkata'})}\n\nYaad dila diya Boss!` });
                console.log(`Reminder sent: ${rem.task}`);
                if (rem.repeat === 'yearly') {
                    rem.datetime = new Date(remTime.setFullYear(remTime.getFullYear() + 1)).toISOString();
                    rem.sent = false;
                } else { rem.sent = true; }
                changed = true;
            } catch (e) { console.error("Reminder send error", e.message); }
        }
    }
    if (changed) saveReminders(reminders);
});

async function extractReminderWithAI(text, from) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const prompt = `Current time: ${nowStr} (Asia/Kolkata). User says: "${text}". Extract reminder. If user says "2 minute baad", add 2 minutes to current time. If says date like "5 December ko 10 baje", make date. Return ONLY JSON: {"isReminder":true/false, "task":"string like 'Pinky Birthday' or 'Chai peena' - extract ANY name/task", "datetime":"ISO string like 2026-12-05T10:00:00+05:30", "repeat":"yearly if birthday/anniversary else none"}. No extra text.`;
        const result = await model.generateContent(prompt);
        let jsonStr = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(jsonStr);
        if (data.isReminder && data.task && data.datetime) {
            const reminders = loadReminders();
            reminders.push({ id: Date.now(), to: from, task: data.task, datetime: data.datetime, repeat: data.repeat || 'none', sent: false, createdAt: new Date().toISOString() });
            saveReminders(reminders);
            return data;
        }
        return null;
    } catch (e) { console.error("AI Extract Error", e.message); return null; }
}

app.post('/whatsapp', async (req, res) => {
    const incomingMsg = req.body.Body?.trim() || '';
    const from = req.body.From;
    console.log(`Msg from ${from}: ${incomingMsg}`);
    if (!incomingMsg) return res.sendStatus(200);
    try {
        const reminderData = await extractReminderWithAI(incomingMsg, from);
        if (reminderData) {
            const d = new Date(reminderData.datetime);
            const pretty = d.toLocaleString('en-IN', { day:'2-digit', month:'long', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Kolkata' });
            const msg = `Done Boss! ✅ Reminder Set!\n\n📌 Task: *${reminderData.task}*\n📅 On: ${pretty}\n🔁 Repeat: ${reminderData.repeat}\n\nTime pe yaad dila dunga!`;
            await client.messages.create({ from: FROM_NUMBER, to: from, body: msg });
            return res.sendStatus(200);
        }
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`You are JARVIS, helpful assistant for Boss. Reply short in Hindi/English mix. User: ${incomingMsg}`);
        const reply = result.response.text();
        await client.messages.create({ from: FROM_NUMBER, to: from, body: reply });
        res.sendStatus(200);
    } catch (error) {
        console.error("Parse error", error.message);
        try { await client.messages.create({ from: FROM_NUMBER, to: from, body: `Boss thoda error aaya, phir se bolo!` }); } catch(e){}
        res.sendStatus(200);
    }
});

app.get('/', (req,res) => res.send('Jarvis Real Reminder Online ✅'));
app.get('/reminders', (req,res) => res.json(loadReminders()));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Jarvis ON ${PORT}`));
