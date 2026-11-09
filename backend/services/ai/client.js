// backend/services/ai/client.js
const { ChatGroq } = require('@langchain/groq');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { ChatOpenAI } = require('@langchain/openai');
require('dotenv').config();

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// รายการ Model presets ที่รองรับ
const MODEL_REGISTRY = {
  // Groq Models
  'groq-gpt-120b': { provider: 'groq', modelName: 'openai/gpt-oss-120b', label: 'Groq: GPT-120B (ฉลาด/เสถียรสุด)' },
  'groq-gpt-20b': { provider: 'groq', modelName: 'openai/gpt-oss-20b', label: 'Groq: GPT-20B (น้ำหนักเบา/ตอบไว)' },
  'groq-qwen-27b': { provider: 'groq', modelName: 'qwen/qwen3.8-27b', label: 'Groq: Qwen 3.8 27B (เข้าใจไทยดี)' },
  // OpenRouter Models
  'openrouter-nemotron': { provider: 'openrouter', modelName: 'nvidia/nemotron-3.5-lightning:free', label: 'OpenRouter: Nemotron 3.5 (Free)' },
  'openrouter-gemma': { provider: 'openrouter', modelName: 'google/gemma-4-31b-it:free', label: 'OpenRouter: Gemma 4 31B (Free)' },
  // Google Gemini Models
  'gemini-1.5-flash': { provider: 'google', modelName: 'gemini-1.5-flash', label: 'Gemini: 1.5 Flash' },
  'gemini-1.5-pro': { provider: 'google', modelName: 'gemini-1.5-pro', label: 'Gemini: 1.5 Pro' },
  'gemini-2.0-flash-exp': { provider: 'google', modelName: 'gemini-2.0-flash-exp', label: 'Gemini: 2.0 Flash (Experimental)' },
};

function getOpenRouterModel(modelName = 'nvidia/nemotron-3.5-lightning:free', options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter API key not found. กรุณาระบุ OPENROUTER_API_KEY ในไฟล์ backend/.env');
  }
  return new ChatOpenAI({
    apiKey,
    modelName,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AISchedule Assistant',
      },
    },
    temperature: options.temperature !== undefined ? options.temperature : 0.2,
  });
}

function getGroqModel(modelName = 'openai/gpt-oss-120b', options = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API key not found. กรุณาระบุ GROQ_API_KEY ในไฟล์ backend/.env');
  }
  return new ChatGroq({
    apiKey,
    model: modelName,
    temperature: options.temperature !== undefined ? options.temperature : 0.2,
  });
}

function getGoogleModel(modelName = 'gemini-1.5-flash', options = {}) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Google API key not found. กรุณาระบุ GOOGLE_API_KEY ในไฟล์ backend/.env');
  }
  return new ChatGoogleGenerativeAI({
    apiKey,
    model: modelName,
    temperature: options.temperature !== undefined ? options.temperature : 0.2,
  });
}

/**
 * ดึง Chat Model ตาม key หรือชื่อ model
 * @param {string} modelKey เช่น 'groq-qwen-27b', 'groq-gpt-120b', 'openrouter-nemotron', 'gemini-1.5-flash'
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
    if (reg.provider === 'openrouter') {
      return getOpenRouterModel(reg.modelName, options);
    }
    return getGroqModel(reg.modelName, options);
  }

  // 2. ถ้าส่งชื่อ provider มาแบบย่อ
  if (key === 'openrouter' || key.startsWith('openrouter/')) {
    const actualModel = key.replace('openrouter/', '');
    return getOpenRouterModel(actualModel || 'nvidia/nemotron-3.5-lightning:free', options);
  }
  if (key === 'google' || key === 'gemini') {
    return getGoogleModel('gemini-1.5-flash', options);
  }
  if (key.includes('qwen')) {
    return getGroqModel('qwen/qwen3.8-27b', options);
  }
  if (key.includes('nemotron')) {
    return getOpenRouterModel('nvidia/nemotron-3.5-lightning:free', options);
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
  getOpenRouterModel,
  MODEL_REGISTRY,
  GROQ_API_KEY,
  GOOGLE_API_KEY,
  OPENROUTER_API_KEY,
};
