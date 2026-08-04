const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Dono URL pe sunega - /whatsapp and /webhook
app.post(['/whatsapp', '/webhook', '/'], async (req, res) => {
  const msg = req.body.Body || 'Hi';
  console.log('Incoming:', msg);
  
  let reply = `Hi Boss! Main ON hu ✅ Aapne bola: "${msg}"`;
  
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContent(`You are Jarvis, a cool Hinglish assistant. User: ${msg}. Reply in short Hinglish.`);
    reply = result.response.text();
    console.log('Gemini Reply:', reply);
  } catch (e) {
    console.log('Gemini Error:', e.message);
  }

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.get('/', (req, res) => res.send('Jarvis is LIVE Boss!'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Jarvis LIVE on ${PORT}`));
