const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const twilio = require('twilio');

const app = express();
app.use(express.urlencoded({ extended: false }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function transcribeAudio(mediaUrl) {
  try {
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const res = await fetch(mediaUrl, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    const arrayBuffer = await res.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    
    const result = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [{
        role: 'user',
        parts: [
          { text: "Transcribe this audio exactly in the same language the user spoke. If Hindi, transcribe in Hindi. Just give transcription, nothing else." },
          { inlineData: { mimeType: 'audio/ogg', data: base64Audio } }
        ]
      }]
    });
    return result.text;
  } catch (e) {
    console.log('Transcribe error', e.message);
    return null;
  }
}

app.post('/webhook', async (req, res) => {
  let userMsg = req.body.Body || '';
  const numMedia = parseInt(req.body.NumMedia || '0');
  const mediaType = req.body.MediaContentType0 || '';

  console.log('Incoming Type:', mediaType, 'Text:', userMsg);

  // VOICE NOTE HANDLING
  if (numMedia > 0 && mediaType.includes('audio')) {
    const mediaUrl = req.body.MediaUrl0;
    console.log('Voice URL:', mediaUrl);
    const transcription = await transcribeAudio(mediaUrl);
    if (transcription) {
      userMsg = transcription;
      console.log('Transcribed:', userMsg);
    } else {
      userMsg = 'Voice note received but could not transcribe';
    }
  }

  if (!userMsg) userMsg = 'Hi';

  let reply = 'Hi boss!';
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `You are Jarvis, a friendly WhatsApp AI assistant made for your boss.
Rules:
- Auto-detect user's language (Hindi, English, Gujarati, Hinglish) and ALWAYS reply in same language.
- If user speaks Hindi, reply in Hindi.
- You are helpful, witty, short but detailed.
- User said: ${userMsg}`
    });
    reply = result.text || 'Samajh gaya boss!';
  } catch (err) {
    console.log('AI Error:', err.message);
    reply = 'Thoda network issue hai boss, 10 sec me fir se bolo!';
  }

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(reply);
  res.type('text/xml').send(twiml.toString());
});

app.get('/', (req, res) => res.send('Jarvis Live - Voice + Hindi + Text'));
app.listen(process.env.PORT || 10000, () => console.log('Jarvis Voice Live'));
