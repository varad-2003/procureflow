import { testGeminiConnectivity, testGeminiStructuredExtraction } from '../src/services/ai/gemini.js';

try {
  const result = await testGeminiConnectivity();
  const extraction = await testGeminiStructuredExtraction();
  console.log(JSON.stringify({
    gemini: 'connected',
    model: result.model,
    responseLength: result.responseLength,
    structuredModel: extraction.model,
    structuredResult: extraction.parsed
  }));
  process.exit(0);
} catch (error) {
  console.error('Gemini connectivity failed: model or API request rejected');
  process.exit(1);
}
