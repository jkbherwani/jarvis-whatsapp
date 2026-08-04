const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => res.send('Jarvis LIVE'));

app.post('/whatsapp', async (req, res) => {
  const userMsg = req.body.Body || 'Hi';
  console.log('Incoming:', userMsg);
  
  let reply = `Hi Boss! Main ON hu! Aapne bola: "${userMsg}" Thoda Gemini slow tha isliye direct bola!`;

  try {
    if(process.env.GEMINI_API_KEY){
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      
      // Fast reply - 7 sec timeout
      const result = await Promise.race([
        model.generateContent(`You are Jarvis assistant for Jagdish. Reply short in Hinglish. User: ${userMsg}`),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 7000))
      ]);
      reply = result.response.text().substring(0,1500);
      console.log('Gemini:', reply);
    }
  } catch(e) {
    console.log('Gemini error:', e.message);
  }

  // IMPORTANT - Twilio ko XML bhejna hai, is format me hi jayega WhatsApp pe
  res.set('Content-Type', 'text/xml');
  const xml = `<Response><Message><![CDATA[${reply}]]></Message></Response>`;
  console.log('Sending to Twilio:', xml);
  res.send(xml);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('LIVE on ' + PORT));
