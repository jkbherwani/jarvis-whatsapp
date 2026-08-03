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

app.get('/', (req,res)=> res.send('Jarvis Google Latest Online Boss!') );

app.post('/webhook', async (req,res)=>{
  const from = req.body.From;
  const to = req.body.To;
  const userMsg = req.body.Body || "";
  const mediaUrl = req.body.MediaUrl0;
  const mediaType = req.body.MediaContentType0;

  let finalText = userMsg;
  let isVoice = false;

  if(mediaUrl && mediaType && mediaType.includes('audio')){
    try{
      const audioRes = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
        auth: { username: process.env.TWILIO_ACCOUNT_SID, password: process.env.TWILIO_AUTH_TOKEN }
      });
      // GOOGLE LATEST MODEL FOR VOICE
      const model = genAI.getGenerativeModel({model:"gemini-flash-latest"});
      const result = await model.generateContent([
        { inlineData: { data: Buffer.from(audioRes.data).toString('base64'), mimeType: mediaType } },
        { text: "Transcribe exactly Hindi/English. Only transcription." }
      ]);
      finalText = result.response.text();
      isVoice = true;
      console.log("Transcribed:", finalText);
    }catch(e){ console.log("Voice error",e.message); }
  }

  if(!finalText) finalText = "Hi";

  let jarvisReply = "";
  try{
    // GOOGLE LATEST MODEL FOR TEXT - THIS WAS WORKING!
    const model = genAI.getGenerativeModel({model:"gemini-flash-latest"});
    const result = await model.generateContent(`You are Jarvis, friendly assistant for Boss in Ahmedabad. Reply in same language user used (Hindi+English mix). Keep short, call him Boss. User: ${finalText}`);
    jarvisReply = result.response.text();
  }catch(e){
    jarvisReply = "Boss thoda error aaya, phir se bolo!";
    console.log("Gemini error", e.message);
  }

  if(isVoice && process.env.ELEVENLABS_API_KEY){
    try{
      if(!fs.existsSync('public')) fs.mkdirSync('public');
      const fileName = `jarvis_${Date.now()}.mp3`;
      const filePath = path.join(__dirname, 'public', fileName);
      const voiceId = "21m00Tcm4TlvDq8ikWAM";
      const ttsRes = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        { text: jarvisReply, model_id: "eleven_multilingual_v2", voice_settings:{ stability:0.5, similarity_boost:0.7 } },
        { headers:{ "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type":"application/json" }, responseType:'arraybuffer' }
      );
      fs.writeFileSync(filePath, ttsRes.data);
      const audioPublicUrl = `https://${req.get('host')}/audio/${fileName}`;
      await client.messages.create({ from: to, to: from, body: jarvisReply, mediaUrl: [audioPublicUrl] });
      setTimeout(()=>{ if(fs.existsSync(filePath)) fs.unlinkSync(filePath); }, 120000);
      return res.send('<Response></Response>');
    }catch(e){ console.log("ElevenLabs Error", e.message); }
  }

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(jarvisReply);
  res.type('text/xml').send(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Jarvis Latest on '+PORT));
