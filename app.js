const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const twilio = require('twilio');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use('/audio', express.static(path.join(__dirname, 'public')));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

app.get('/', (req,res)=> res.send('Jarvis Talking Online Boss!') );

app.post('/webhook', async (req,res)=>{
  const from = req.body.From;
  const to = req.body.To;
  const userMsg = req.body.Body || "";
  const mediaUrl = req.body.MediaUrl0;
  const mediaType = req.body.MediaContentType0;

  let finalText = userMsg;
  let isVoice = false;

  // If user sent voice note, transcribe with Gemini
  if(mediaUrl && mediaType && mediaType.includes('audio')){
    try{
      const audioRes = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
        auth: { username: process.env.TWILIO_ACCOUNT_SID, password: process.env.TWILIO_AUTH_TOKEN }
      });
      const model = genAI.getGenerativeModel({model:"gemini-1.5-flash"});
      const result = await model.generateContent([
        { inlineData: { data: Buffer.from(audioRes.data).toString('base64'), mimeType: mediaType } },
        { text: "Transcribe this audio, detect Hindi/English. Reply only transcription." }
      ]);
      finalText = result.response.text();
      isVoice = true;
    }catch(e){ console.log("Voice transcribe error",e); }
  }

  if(!finalText) finalText = "Hi";

  // Gemini reply
  let jarvisReply = "";
  try{
    const model = genAI.getGenerativeModel({model:"gemini-1.5-flash"});
    const prompt = `You are Jarvis, a friendly helpful assistant for a user in Ahmedabad near Airport. User speaks Hindi + English mix (Hinglish). Reply in same language user used. Keep replies short, friendly, call him Boss sometimes. User says: ${finalText}`;
    const result = await model.generateContent(prompt);
    jarvisReply = result.response.text();
  }catch(e){
    jarvisReply = "Boss thoda error aaya, phir se bolo!";
  }

  // If user sent voice note, reply with VOICE + TEXT
  if(isVoice && process.env.ELEVENLABS_API_KEY){
    try{
      // Ensure public folder
      if(!fs.existsSync('public')) fs.mkdirSync('public');
      const fileName = `jarvis_${Date.now()}.mp3`;
      const filePath = path.join(__dirname, 'public', fileName);

      // ElevenLabs TTS - Auto Hindi/English voice
      const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel - works for Hindi+English
      const ttsRes = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        { text: jarvisReply, model_id: "eleven_multilingual_v2", voice_settings:{ stability:0.5, similarity_boost:0.7 } },
        { headers:{ "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type":"application/json" }, responseType:'arraybuffer' }
      );
      fs.writeFileSync(filePath, ttsRes.data);

      const audioPublicUrl = `https://${req.get('host')}/audio/${fileName}`;

      await client.messages.create({
        from: to,
        to: from,
        body: jarvisReply,
        mediaUrl: [audioPublicUrl]
      });

      // Auto delete file after 2 mins
      setTimeout(()=>{ if(fs.existsSync(filePath)) fs.unlinkSync(filePath); }, 120000);

      return res.send('<Response></Response>');
    }catch(e){ console.log("TTS Error", e.response?.data || e.message); }
  }

  // Normal text reply
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(jarvisReply);
  res.type('text/xml').send(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Jarvis Talking on '+PORT));
