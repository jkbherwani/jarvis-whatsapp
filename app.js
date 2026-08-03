const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const twilio = require('twilio');

const app = express();
app.use(express.urlencoded({ extended: false }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/webhook', async (req, res) => {
  const msg = req.body.Body || 'Hi';
  console.log('Incoming:', msg);
  let reply = 'Hi boss I am Jarvis!';
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `You are Jarvis, friendly WhatsApp assistant. Keep reply short under 80 words. User: ${msg}`
    });
    reply = result.text || 'Got it boss!';
    console.log('Reply:', reply);
  } catch (err) {
    console.log('Full Error:', err.message || err);
    reply = 'Jarvis is thinking... try again in 10 sec boss!';
  }
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(reply);
  res.type('text/xml').send(twiml.toString());
});

app.get('/', (req, res) => res.send('Jarvis Live - flash-latest'));
app.listen(process.env.PORT || 10000, () => console.log('Jarvis Live'));
