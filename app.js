const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const app = express();
app.use(express.urlencoded({ extended: true }));

app.post('/whatsapp', async (req, res) => {
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
    console.log('Gemini Error, using fallback:', e.message);
    reply = `Hi Boss! Main ON hu ✅ Aapne bola: "${msg}"\nThoda Gemini slow tha, isiliye direct bola!`;
  }

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Jarvis LIVE on ${PORT}`));
