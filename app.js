const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// YE LINE SABSE IMPORTANT HAI - HAR REQUEST KO LOG KAREGI
app.use((req, res, next) => {
  console.log(`HIT: ${req.method} ${req.path} Body:${JSON.stringify(req.body)}`);
  next();
});

app.post(['/','/whatsapp','/webhook'], async (req, res) => {
  const msg = req.body.Body || 'Hi';
  console.log('Incoming:', msg);
  let reply = `Hi Boss ON hu! Aapne bola: ${msg}`;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContent(`You are Jarvis, reply in Hinglish short. User: ${msg}`);
    reply = result.response.text();
    console.log('Gemini:', reply);
  } catch (e) {
    console.log('Error:', e.message);
  }
  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.get('/', (req, res) => res.send('Jarvis LIVE'));

app.listen(process.env.PORT || 10000, () => console.log('Jarvis LIVE'));
