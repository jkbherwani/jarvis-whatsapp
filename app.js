const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const twilio = require('twilio');

const app = express();
app.use(express.urlencoded({ extended: false }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/webhook', async (req, res) => {
  const msg = req.body.Body || 'Hi';
  console.log('Incoming:', msg);
  let reply = 'Hi! I am Jarvis';
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `You are Jarvis, friendly WhatsApp assistant. Reply short (under 100 words). User: ${msg}`
    });
    reply = result.text || result.response?.text || 'Got it boss!';
  } catch (err) {
    console.log('Full Error:', err);
    reply = 'Jarvis error: ' + (err.message || 'Try again in 1 min');
  }
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(reply);
  res.type('text/xml').send(twiml.toString());
});

app.get('/', (req, res) => res.send('Jarvis Running! AQ Supported!'));
app.listen(process.env.PORT || 10000, () => console.log('Jarvis Live'));
