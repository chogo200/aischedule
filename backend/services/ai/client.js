// backend/services/ai/client.js
const { ChatGroq } = require('@langchain/groq');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
require('dotenv').config();

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

// รายการ Model presets ที่รองรับ
const MODEL_REGISTRY = {
  // Groq Models
  'groq-gpt-120b': { provider: 'groq', modelName: 'openai/gpt-oss-120b', label: 'Groq: GPT-120B (ฉลาด/เสถียรสุด)' },
  'groq-qwen-27b': { provider: 'groq', modelName: 'qwen/qwen3.8-27b', label: 'Groq: Qwen 3.8 27B (เร็ว/เข้าใจไทยดี)' },
  'groq-gpt-20b': { provider: 'groq', modelName: 'openai/gpt-oss-20b', label: 'Groq: GPT-20B (น้ำหนักเบา/ตอบไว)' },
  'groq-llama-3.3-70b': { provider: 'groq', modelName: 'llama-3.3-70b-versatile', label: 'Groq: LLaMA 3.3 70B' },
  'groq-llama-3.1-8b': { provider: 'groq', modelName: 'llama-3.1-8b-instant', label: 'Groq: LLaMA 3.1 8B' },
  // Google Gemini Models
  'gemini-1.5-flash': { provider: 'google', modelName: 'gemini-1.5-flash', label: 'Gemini: 1.5 Flash' },
  'gemini-1.5-pro': { provider: 'google', modelName: 'gemini-1.5-pro', label: 'Gemini: 1.5 Pro' },
  'gemini-2.0-flash-exp': { provider: 'google', modelName: 'gemini-2.0-flash-exp', label: 'Gemini: 2.0 Flash (Experimental)' },
};

function getGroqModel(modelName = 'openai/gpt-oss-120b', options = {}) {
  return new ChatGroq({
    apiKey: GROQ_API_KEY,
    model: modelName,
    temperature: options.temperature !== undefined ? options.temperature : 0.2,
  });
}

function getGoogleModel(modelName = 'gemini-1.5-flash', options = {}) {
  return new ChatGoogleGenerativeAI({
    apiKey: GOOGLE_API_KEY,
    model: modelName,
    temperature: options.temperature !== undefined ? options.temperature : 0.2,
  });
}

/**
 * ดึง Chat Model ตาม key หรือชื่อ model
 * @param {string} modelKey เช่น 'groq-qwen-27b', 'groq-gpt-120b', 'gemini-1.5-flash', 'groq', 'google'
 * @param {object} options
 */
function getModel(modelKey = 'groq-gpt-120b', options = {}) {
  const key = (modelKey || 'groq-gpt-120b').toLowerCase();

  // 1. ตรวจสอบ Registry ตรงๆ
  if (MODEL_REGISTRY[key]) {
    const reg = MODEL_REGISTRY[key];
    if (reg.provider === 'google') {
      return getGoogleModel(reg.modelName, options);
    }
    return getGroqModel(reg.modelName, options);
  }

  // 2. ถ้าส่งชื่อ provider มาแบบย่อ
  if (key === 'google' || key === 'gemini') {
    return getGoogleModel('gemini-1.5-flash', options);
  }
  if (key.includes('qwen')) {
    return getGroqModel('qwen/qwen3.8-27b', options);
  }
  if (key.includes('llama')) {
    return getGroqModel('llama-3.3-70b-versatile', options);
  }
  if (key.includes('gemini')) {
    return getGoogleModel(modelKey, options);
  }

  // ค่าเริ่มต้น: Groq GPT-120B
  return getGroqModel('openai/gpt-oss-120b', options);
}

module.exports = {
  getModel,
  getGroqModel,
  getGoogleModel,
  MODEL_REGISTRY,
  GROQ_API_KEY,
  GOOGLE_API_KEY,
};
