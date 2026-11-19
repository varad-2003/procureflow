import { GoogleGenAI } from '@google/genai';
import { env } from '../src/config/env.js';

const candidates = [
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash'
];

if (!env.geminiApiKey) {
  console.error('GEMINI_API_KEY is not configured');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });

for (const model of candidates) {
  try {
    const response = await ai.models.generateContent({
      model,
      contents: 'Reply with exactly: CONNECTED'
    });
    const text = response.text?.trim();
    if (text) {
      console.log(JSON.stringify({ model, success: true, text }));
      process.exit(0);
    }
  } catch (error) {
    const status = error?.status || error?.error?.code || 'unknown';
    console.log(JSON.stringify({ model, success: false, status }));
  }
}

console.error('No verified free Gemini model generated a response');
process.exit(1);
