import mongoose from 'mongoose';
import { env } from './config/env.js';

export async function connectDatabase() {
  if (!env.mongoUri) {
    throw new Error('MONGODB_URI is not configured');
  }
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000
  });
  const ping = await mongoose.connection.db.admin().ping();
  return { connected: mongoose.connection.readyState === 1, pinged: ping?.ok === 1 };
}

export async function pingDatabase() {
  if (mongoose.connection.readyState !== 1) {
    return { connected: false, pinged: false };
  }
  const ping = await mongoose.connection.db.admin().ping();
  return { connected: true, pinged: ping?.ok === 1 };
}
