const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Memory for chat
let chatHistory = {};

app.get('/', (req, res) => {
  res.send('Jarvis is LIVE Boss! 🤖');
});

app.post('/webhook', async (req, res) => {
  const from = req.body.From;
  const incomingMsg = req.body.Body;
  console.log(`Message from ${from}: ${incomingMsg}`);

  if (!chatHistory[from]) chatHistory[from] = [];

  chatHistory[from].push({ role: "user", parts: [{ text: incomingMsg }] });

  try {
    const prompt = `You are Jarvis, a helpful personal assistant for Aatrey. User said: "${incomingMsg}". Reply in friendly, short, helpful way like Jarvis from Iron Man. If user asks to set reminder, say you will remind. Keep reply under 100 words.`;

    const result = await model.generateContent(prompt);
    const reply = result.response.text();

    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: from,
      body: reply
    });

    chatHistory[from].push({ role: "model", parts: [{ text: reply }] });
    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(200).send('Error handled');
  }
});

app.listen(PORT, () => console.log(`Jarvis running on port ${PORT}`));