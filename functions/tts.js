const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const ALLOWED_VOICES = ["th-TH-PremwadeeNeural", "th-TH-NiwatNeural"];
const MAX_CHARS = 1000;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const text = String(body.text || "").trim();
  const voice = ALLOWED_VOICES.includes(body.voice) ? body.voice : ALLOWED_VOICES[0];
  const rate = /^[+-]\d{1,3}%$/.test(body.rate) ? body.rate : "+0%";

  if (!text) return { statusCode: 400, body: "No text" };
  if (text.length > MAX_CHARS) return { statusCode: 400, body: "Text too long" };

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text, { rate });

    const buffer = await new Promise((resolve, reject) => {
      const chunks = [];
      audioStream.on("data", (c) => chunks.push(c));
      audioStream.on("close", () => resolve(Buffer.concat(chunks)));
      audioStream.on("end", () => resolve(Buffer.concat(chunks)));
      audioStream.on("error", reject);
    });

    console.log("TTS bytes:", buffer.length);

    if (buffer.length < 1000) {
      return {
        statusCode: 502,
        body: "TTS returned empty audio (" + buffer.length + " bytes). Microsoft service may have rejected the request.",
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "audio/mpeg" },
      body: buffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    console.error("TTS error:", e);
    return { statusCode: 500, body: "TTS error: " + e.message };
  }
};

