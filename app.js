const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const twilioLib = require('twilio');
const app = express();
app.use(express.urlencoded({ extended: true }));

app.post('/whatsapp', async (req, res) => {
  const userMsg = req.body.Body || 'Hi';
  const from = req.body.From; // whatsapp:+91...
  const to = req.body.To; // whatsapp:+1415...
  console.log('Incoming:', userMsg, 'From:', from);

  let reply = `Hi Boss! Main ON hu! "${userMsg}"`;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await Promise.race([
      model.generateContent(`You are Jarvis for Jagdish. Reply short Hinglish. User: ${userMsg}`),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
    ]);
    reply = result.response.text().substring(0,1500);
    console.log('Gemini:', reply);
  } catch(e){ console.log('Gemini error:', e.message); }

  // Method 1: Try REST API (100% works)
  try {
    if(process.env.TWILIO_ACCOUNT_SID){
      const client = twilioLib(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({ body: reply, from: to, to: from });
      console.log('SENT VIA REST API to', from);
    }
  } catch(err){ console.log('REST error:', err.message); }

  // Method 2: TwiML backup
  res.set('Content-Type','text/xml');
  res.send(`<Response><Message><![CDATA[${reply}]]></Message></Response>`);
});

app.get('/', (req,res)=>res.send('Jarvis LIVE'));
app.listen(process.env.PORT||10000, ()=>console.log('LIVE'));
