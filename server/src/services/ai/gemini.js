import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';

export function createGeminiClient() {
  if (!env.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey: env.geminiApiKey });
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function getVerifiedFreeFallbacks(primary = env.geminiModel) {
  return [...new Set([primary, 'gemini-flash-lite-latest'])].filter(Boolean);
}

async function generateWithFallback(prompt, config) {
  const ai = createGeminiClient();
  let lastError;
  for (const model of getVerifiedFreeFallbacks()) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config
        });
        const text = response.text?.trim();
        if (!text) throw new Error('Gemini returned an empty response');
        return { text, model };
      } catch (error) {
        lastError = error;
        const status = error?.status || error?.error?.code;
        if (status === 404 || status === 403 || status === 429) break;
        if (status === 503 && attempt === 0) {
          await sleep(500);
          continue;
        }
        break;
      }
    }
  }
  throw lastError || new Error('Gemini generation failed');
}

export async function testGeminiConnectivity() {
  const result = await generateWithFallback(
    'Reply with the single word CONNECTED.',
    { maxOutputTokens: 16, temperature: 0 }
  );
  return { connected: true, model: result.model, responseLength: result.text.length, text: result.text };
}

export async function testGeminiStructuredExtraction() {
  const result = await generateWithFallback(
    'Extract item, quantity, and plant from this purchase request. Return exactly one valid JSON object, never an array. Use keys item, quantity, and plant. Request: Need 200 nitrile gloves for Chakan.',
    { maxOutputTokens: 128, temperature: 0, responseMimeType: 'application/json' }
  );
  return { model: result.model, parsed: JSON.parse(result.text) };
}

export async function extractPurchaseRequest(message, referenceDate = new Date()) {
  const prompt = `Extract a purchase requisition from the employee message. Return exactly one valid JSON object with keys item, quantity, plant, needByDate, urgency. Use null for missing values. Plant must be PUN1 or CHK1 if clear, or null otherwise. Use urgency "Emergency" or "Normal"; use null if unclear. Resolve relative dates from reference date ${referenceDate.toISOString().slice(0, 10)} and return needByDate as YYYY-MM-DD. Message: ${message}`;
  const result = await generateWithFallback(prompt, {
    maxOutputTokens: 256,
    temperature: 0,
    responseMimeType: 'application/json'
  });
  const parsed = JSON.parse(result.text);
  return { model: result.model, extracted: parsed };
}
