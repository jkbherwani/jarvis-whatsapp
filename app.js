const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const twilio = require('twilio');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`HIT: ${req.method} ${req.path} Body:${JSON.stringify(req.body).substring(0,200)}`);
  next();
});

app.get('/', (req,res) => res.send('Jarvis LIVE - https://jarvis-whatsapp-pcjx.onrender.com'));

app.post('/whatsapp', async (req, res) => {
  const incomingMsg = req.body.Body || 'Hi';
  console.log(`Incoming: ${incomingMsg}`);

  let replyText = `Hi Boss! Main ON hu! Aapne bola: "${incomingMsg}"`;

  try {
    if (process.env.GEMINI_API_KEY) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await Promise.race([
        model.generateContent(`You are Jarvis, helpful assistant of Jagdish Bherwani. Reply in Hinglish short. User: ${incomingMsg}`),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
      ]);
      const text = result.response.text();
      if(text) replyText = text;
      console.log(`Gemini: ${replyText}`);
    }
  } catch (e) {
    console.log(`Gemini Error/Timeout: ${e.message}, using fallback`);
  }

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(replyText);
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Jarvis LIVE on ${PORT}`));
