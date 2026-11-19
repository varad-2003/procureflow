import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(configDirectory, '../..');
dotenv.config({ path: path.join(serverDirectory, '.env') });

export const env = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'local-development-secret',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest'
};
