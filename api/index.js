import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL, URLSearchParams } from 'url';

// Supabase Database Integration (Postgres Persistence)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gxwxnygvrgwbshhddltc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4d3hueWd2cmd3YnNoaGRkbHRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MTMwNDQsImV4cCI6MjEwNDA4OTA0NH0.AaidTZdD995SAtS0QbnRh2F3IE-5Xz9U94arPyePPoo';

async function syncToSupabase(userData) {
  if (!userData || !userData.instanceName) return;
  try {
    const cleanUrl = SUPABASE_URL.replace(/\/+$/, '');
    const urlObj = new URL(cleanUrl + '/rest/v1/registered_users');
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const payload = JSON.stringify({
      instance_name: userData.instanceName,
      business_name: userData.businessName || '',
      phone: userData.phone || '',
      email: userData.email || '',
      faqs: userData.faqs || '',
      location_media_url: userData.locationMediaUrl || '',
      catalog_media_url: userData.catalogMediaUrl || '',
      welcome_media_url: userData.welcomeMediaUrl || '',
      enabled: userData.enabled !== false,
      plan: userData.plan || 'trial',
      allowed_test_phone: userData.allowedTestPhone || userData.phone || '',
      updated_at: new Date().toISOString()
    });

    return new Promise((resolve) => {
      const req = client.request({
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, data: d }));
      });
      req.on('error', e => resolve({ error: e.message }));
      req.write(payload);
      req.end();
    });
  } catch (err) {
    return { error: err.message };
  }
}

async function getSupabaseUsers() {
  try {
    const cleanUrl = SUPABASE_URL.replace(/\/+$/, '');
    const urlObj = new URL(cleanUrl + '/rest/v1/registered_users?select=*&order=updated_at.desc');
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    return new Promise((resolve) => {
      const req = client.request({
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json'
        }
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(d));
            } else {
              resolve([]);
            }
          } catch(e) { resolve([]); }
        });
      });
      req.on('error', () => resolve([]));
      req.end();
    });
  } catch(e) {
    return [];
  }
}

async function sendSupabaseOtp(email) {
  try {
    const cleanUrl = SUPABASE_URL.replace(/\/+$/, '');
    const urlObj = new URL(cleanUrl + '/auth/v1/otp');
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const payload = JSON.stringify({
      email: email.trim().toLowerCase(),
      create_user: true
    });

    return new Promise((resolve) => {
      const req = client.request({
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(d || '{}') }); }
          catch(e) { resolve({ status: res.statusCode, data: d }); }
        });
      });
      req.on('error', e => resolve({ status: 500, error: e.message }));
      req.write(payload);
      req.end();
    });
  } catch (err) {
    return { status: 500, error: err.message };
  }
}

async function verifySupabaseOtp(email, otp) {
  try {
    const cleanUrl = SUPABASE_URL.replace(/\/+$/, '');
    const urlObj = new URL(cleanUrl + '/auth/v1/verify');
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const payload = JSON.stringify({
      type: 'email',
      email: email.trim().toLowerCase(),
      token: otp.trim()
    });

    return new Promise((resolve) => {
      const req = client.request({
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(d || '{}') }); }
          catch(e) { resolve({ status: res.statusCode, data: d }); }
        });
      });
      req.on('error', e => resolve({ status: 500, error: e.message }));
      req.write(payload);
      req.end();
    });
  } catch (err) {
    return { status: 500, error: err.message };
  }
}

// Dynamic Environment Variable Resolvers for Evolution API
function getEvolutionServer(override) {
  const envVal = process.env.EVOLUTION_SERVER || process.env.EVOLUTION_URL || process.env.EVOLUTION_API_URL;
  if (envVal && envVal.trim().length > 5) {
    return envVal.trim().replace(/^http:\/\//, 'https://');
  }
  if (override && typeof override === 'string' && override.startsWith('http') && !override.includes('localhost')) {
    return override.trim().replace(/^http:\/\//, 'https://');
  }
  return 'https://evolution-api-2gki.srv1722699.hstgr.cloud';
}

function getEvolutionKey(override) {
  const envVal = process.env.EVOLUTION_KEY || process.env.EVOLUTION_API_KEY || process.env.GLOBAL_API_KEY;
  if (envVal && envVal.trim().length > 5) {
    return envVal.trim();
  }
  if (override && typeof override === 'string' && override.trim().length > 10 && override !== '429683C4C977415CAAFCCE10F7D57E11') {
    return override.trim();
  }
  return 'ZyrkPropVJGwv6E2krbGEzWp7j9pLaX3';
}

// Durable Persistent Registry for Client Instances (Survives cold starts, restarts & redeployments)
const persistentInstanceRegistry = {
  'avadaspace_design_llc_shaguny123_412': {
    instanceName: 'avadaspace_design_llc_shaguny123_412',
    businessName: 'Avadaspace Design LLC',
    faqs: `- Business Name: Avadaspace Design LLC
- Business Hours: Mon-Sat 9:00 AM - 6:00 PM (Closed on Sundays)
- Services & Pricing:
  * Consultation & Assessment: $50
  * Full Design Package: $150 - $400
  * Custom Development: $300+
- Location & Address: Main Office Suite 400
- Booking Link: Reply here to reserve an appointment
- Emergency Contact: Call (555) 019-2834`,
    locationMediaUrl: 'https://lh3.googleusercontent.com/d/1O5vQRbxIT259y1wDCE1-JPjQ34dLtsry',
    catalogMediaUrl: '',
    welcomeMediaUrl: '',
    serverUrl: getEvolutionServer(),
    serverKey: getEvolutionKey(),
    enabled: true,
    plan: 'pro',
    phone: '919198747810',
    allowedTestPhone: '919198747810'
  }
};

// Global active in-memory storage initialized from persistent registry
const memoryConfigs = { ...persistentInstanceRegistry };

// Self-Healing Config Resolver (Guarantees every instance always has active AI)
function getEffectiveConfig(instanceName) {
  const cleanId = instanceName || 'default';
  
  if (memoryConfigs[cleanId]) return memoryConfigs[cleanId];
  if (persistentInstanceRegistry[cleanId]) return persistentInstanceRegistry[cleanId];
  
  // Auto-generate robust default configuration for any newly connected WhatsApp instance
  const cleanName = cleanId
    .replace(/_[a-z0-9]+_\d+$/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  const autoConfig = {
    instanceName: cleanId,
    businessName: cleanName || 'Our Business',
    faqs: `- Business Name: ${cleanName || 'Our Business'}
- Business Hours: Mon-Sat 9:00 AM - 6:00 PM (Closed on Sundays)
- Services: Professional services and consultations
- Booking: Reply here to schedule an appointment`,
    locationMediaUrl: '',
    catalogMediaUrl: '',
    welcomeMediaUrl: '',
    serverUrl: getEvolutionServer(),
    serverKey: getEvolutionKey(),
    enabled: true, // Always active by default
    plan: 'trial', // Default SaaS trial mode
    phone: '',
    allowedTestPhone: ''
  };

  memoryConfigs[cleanId] = autoConfig;
  return autoConfig;
}

// Multi-turn conversation memory cache (16 messages / 24-hour retention)
const conversationHistories = {};
const historyTimestamps = {};

// Human Intervention / Takeover Tracker (Pauses AI when a human operator messages)
const humanInterventions = {};
const botSentTimestamps = {};

function getCustomerHistory(instanceName, senderId) {
  const key = `${instanceName}:${senderId}`;
  const now = Date.now();

  // Auto-clean history after 24 hours of inactivity
  if (historyTimestamps[key] && now - historyTimestamps[key] > 24 * 60 * 60 * 1000) {
    delete conversationHistories[key];
    delete historyTimestamps[key];
    return [];
  }

  return conversationHistories[key] || [];
}

function addToHistory(instanceName, senderId, role, text) {
  const key = `${instanceName}:${senderId}`;
  if (!conversationHistories[key]) {
    conversationHistories[key] = [];
  }
  historyTimestamps[key] = Date.now();

  conversationHistories[key].push({
    role: role === 'user' ? 'user' : 'model',
    parts: [{ text: text.slice(0, 1000) }]
  });

  // Keep the most recent 16 messages (8 conversational turns)
  if (conversationHistories[key].length > 16) {
    conversationHistories[key] = conversationHistories[key].slice(-16);
  }
}

function recordBotSent(instanceName, senderId) {
  const key = `${instanceName}:${senderId}`;
  botSentTimestamps[key] = Date.now();
}

function recordHumanIntervention(instanceName, customerPhone) {
  const key = `${instanceName}:${customerPhone}`;
  const lastBotTime = botSentTimestamps[key] || 0;
  // If this outgoing message was not sent by the AI in the last 4 seconds, a real human operator sent it
  if (Date.now() - lastBotTime > 4000) {
    humanInterventions[key] = Date.now();
    console.log(`[Human Takeover] Manual message sent to ${customerPhone}. Bot auto-reply paused for 24 hours.`);
  }
}

function isHumanIntervened(instanceName, senderId) {
  const key = `${instanceName}:${senderId}`;
  const takeoverTime = humanInterventions[key];
  if (!takeoverTime) return false;

  // Active for 24 hours
  if (Date.now() - takeoverTime < 24 * 60 * 60 * 1000) {
    return true;
  }
  delete humanInterventions[key];
  return false;
}

// Helper to safely parse body in any Vercel/Node environment
async function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch(e) { return {}; }
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch(e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, statusCode, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, x-evo-server, x-evo-key');
  res.statusCode = statusCode;
  res.end(JSON.stringify(data));
}

// Convert Google Drive share link to direct downloadable image link
function cleanMediaUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const url = rawUrl.trim();
  if (url.includes('drive.google.com')) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }
  return url;
}

// High-EQ Human Scheduling & Conversation Engine Fallback
function generateSmartReply(userMessage, businessName, faqs, conversationHistory = []) {
  const msg = (userMessage || '').trim();
  const lower = msg.toLowerCase();
  const bName = businessName || 'our team';

  // 1. Extract customer name
  let detectedName = '';
  const nameMatch = msg.match(/(?:my name is|i am|i'm|this is|call me)\s+([A-Za-z]+)/i);
  if (nameMatch && nameMatch[1]) {
    detectedName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
    return `Nice to meet you, ${detectedName}! 👋 Welcome to *${bName}*.\n\nHow can I help you today? Feel free to ask about our services, pricing, hours, or booking an appointment!`;
  }

  for (const turn of conversationHistory) {
    const txt = turn.parts?.[0]?.text || '';
    const m = txt.match(/(?:my name is|i am|i'm|this is|call me|meet you,)\s+([A-Za-z]+)/i);
    if (m && m[1] && m[1].toLowerCase() !== 'bname') {
      detectedName = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      break;
    }
  }

  const nameTag = detectedName ? ` ${detectedName}` : '';

  // 2. Intelligent Appointment Day & Time Slot Checking
  const isTimeOrDayGiven = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today))\b/i.test(lower);
  const lastBotMsg = conversationHistory.slice().reverse().find(t => t.role === 'model')?.parts?.[0]?.text || '';
  const wasBookingContext = /(book|date|time|appointment|schedule|slot|when)/i.test(lastBotMsg) || /(book|schedule|reserve|appointment)/i.test(lower);

  if (isTimeOrDayGiven || wasBookingContext) {
    if (lower.includes('sunday')) {
      return `Sorry${nameTag}, we are closed on Sundays! 🕒 Our working hours are Monday to Saturday from 9:00 AM to 6:00 PM. Could you choose a time between Monday and Saturday instead? 😊`;
    }

    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      const isPm = timeMatch[3].toLowerCase() === 'pm';
      if (isPm && hour !== 12) hour += 12;
      if (!isPm && hour === 12) hour = 0;

      if (hour < 9 || hour >= 18) {
        return `Sorry${nameTag}, that time is outside our working hours! 🕒 We are open Monday to Saturday, 9:00 AM to 6:00 PM. Could you pick a time between 9:00 AM and 6:00 PM?`;
      }
    }

    if (isTimeOrDayGiven) {
      return `Perfect${nameTag}! I've noted *${msg}* for your appointment. 📅 Our team has received your request and will confirm your booking shortly. Is there anything specific you'd like us to prepare for you? 😊`;
    }
  }

  // 3. Conversational Acknowledgements
  if (/^(ok|okay|k|sure|alright|all right|yes|yeah|yep|cool|sounds good|got it|done|perfect|great)$/i.test(lower)) {
    if (/(book|date|time|appointment|schedule|slot)/i.test(lastBotMsg)) {
      return `Awesome${nameTag}! What day and time works best for you? (e.g., Monday at 3:00 PM). Let me know and I'll confirm it for you! 😊`;
    }
    return `Great${nameTag}! Let me know what you'd like to do next or if you have any questions about our services!`;
  }

  // 4. Thank you
  if (/(thank|thanks|thx|appreciate|grateful)/i.test(lower)) {
    return `You're very welcome${nameTag}! 😊 Feel free to message anytime if you need anything else. Have a wonderful day!`;
  }

  // 5. Booking / Appointment Request (Initial)
  if (/(book|appointment|schedule|slot|reserve|visit)/i.test(lower)) {
    return `📅 I'd be delighted to help you book an appointment${nameTag}!\n\nWe are open **Monday to Saturday from 9:00 AM to 6:00 PM** (Closed on Sundays).\n\nWhat day and time work best for you?`;
  }

  // 6. Hours / Timing / When open
  if (/(hour|timing|time|open|close|when\s*are\s*you|weekend)/i.test(lower)) {
    return `🕒 *Business Hours for ${bName}:*\n• Monday - Saturday: 9:00 AM - 6:00 PM\n• Sunday: Closed\n\nFeel free to book a slot during our working hours${nameTag}!`;
  }

  // 7. Pricing / Cost / Rates / Catalog / Portfolio
  if (/(price|pricing|cost|how\s*much|rate|charges|fee|catalog|catalogue|brochure|portfolio|sample|package)/i.test(lower)) {
    return `💰 *Pricing & Services for ${bName}:*\n• Consultation & Assessment: $50\n• Complete Package: $150 - $400\n• Custom Development: $300+\n\nWould you like more details or to schedule a consultation${nameTag}? 😊`;
  }

  // 8. Location / Address / Where
  if (/(location|address|where|direction|city|map|store|office|shop)/i.test(lower)) {
    return `📍 *Our Location:*\nWe are located at Main Office Suite 400. Let me know if you need driving directions${nameTag}!`;
  }

  // 9. Natural Follow-up Fallback
  return `I'm here to help${nameTag}! 😊 You can tell me what service you're looking for, or ask about our *pricing*, *timings*, or *booking a slot*. How can I best assist you?`;
}

// Low-level HTTP helper to call Google Gemini API with fallback endpoints and models
function makeGeminiRequest(key, apiVersion, modelName, payload) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/${apiVersion}/models/${modelName}:generateContent?key=${encodeURIComponent(key)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 9000
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(`[${apiVersion}/${modelName}] ${json.error.message}`));
          } else {
            const reply = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (reply && reply.trim().length > 0) {
              resolve(reply.trim());
            } else {
              reject(new Error(`Empty reply from ${modelName}`));
            }
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Gemini API timeout'));
    });
    req.write(payload);
    req.end();
  });
}

// Google Gemini Flash AI Engine with Multi-Turn Memory & Multi-Model Fallback
async function callGeminiWithHistory(apiKey, systemPrompt, conversationHistory, currentUserMessage, businessName, faqs) {
  const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!key || typeof key !== 'string' || key.trim().length < 10) {
    console.log('[Gemini Engine] No valid Gemini API Key found. Using intelligent built-in fallback.');
    return generateSmartReply(currentUserMessage, businessName, faqs, conversationHistory);
  }

  const cleanKey = key.trim();

  const contents = [
    ...(conversationHistory || []),
    {
      role: 'user',
      parts: [{ text: currentUserMessage }]
    }
  ];

  const payload = JSON.stringify({
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: contents,
    generationConfig: {
      maxOutputTokens: 600,
      temperature: 0.7,
      topP: 0.95
    }
  });

  // Try robust combinations recommended by Google Generative AI API
  const attempts = [
    { version: 'v1beta', model: 'gemini-3.6-flash' },
    { version: 'v1beta', model: 'gemini-2.5-flash' },
    { version: 'v1beta', model: 'gemini-2.5-pro' },
    { version: 'v1beta', model: 'gemini-1.5-flash-8b' },
    { version: 'v1beta', model: 'gemini-1.5-flash-002' },
    { version: 'v1beta', model: 'gemini-1.5-pro-002' }
  ];

  for (const { version, model } of attempts) {
    try {
      const reply = await makeGeminiRequest(cleanKey, version, model, payload);
      console.log(`[Gemini Engine] Success with ${version}/${model}`);
      return reply;
    } catch (err) {
      console.warn(`[Gemini Engine] Attempt failed: ${err.message}`);
    }
  }

  // Fallback to Smart Engine if Google fails
  return generateSmartReply(currentUserMessage, businessName, faqs, conversationHistory);
}

// Helper to detect media type from URL extension
function getMediaTypeAndMime(url) {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.mp4') || clean.endsWith('.mov') || clean.endsWith('.avi')) {
    return { mediatype: 'video', mimetype: 'video/mp4' };
  }
  if (clean.endsWith('.pdf')) {
    return { mediatype: 'document', mimetype: 'application/pdf' };
  }
  return { mediatype: 'image', mimetype: 'image/jpeg' };
}

// Forward request to Evolution API (Handles both Text & Media)
function forwardToEvolution(targetUrl, apiKey, method, pathWithQuery, bodyData) {
  return new Promise((resolve) => {
    try {
      const cleanBase = targetUrl.replace(/\/+$/, '');
      const fullUrl = new URL(cleanBase + pathWithQuery);
      const isHttps = fullUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const payload = bodyData ? (typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData)) : null;

      const req = client.request({
        protocol: fullUrl.protocol,
        hostname: fullUrl.hostname,
        port: fullUrl.port || (isHttps ? 443 : 80),
        path: fullUrl.pathname + fullUrl.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      }, res => {
        let resp = '';
        res.on('data', c => resp += c);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(resp) });
          } catch(e) {
            resolve({ status: res.statusCode, data: resp });
          }
        });
      });

      req.on('error', err => resolve({ status: 500, error: err.message }));
      if (payload) req.write(payload);
      req.end();
    } catch(err) {
      resolve({ status: 500, error: err.message });
    }
  });
}

// Vercel Serverless Function Entry Point
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, x-evo-server, x-evo-key');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const rawUrl = req.url || '';
  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const action = parsedUrl.searchParams.get('action') || '';
  let pathParam = parsedUrl.searchParams.get('path') || '';
  const instanceParam = parsedUrl.searchParams.get('instance') || '';

  // Preserve all extra query parameters
  const queryParams = new URLSearchParams(parsedUrl.search);
  queryParams.delete('action');
  queryParams.delete('path');
  queryParams.delete('instance');
  const extraQuery = queryParams.toString();
  if (extraQuery) {
    pathParam += (pathParam.includes('?') ? '&' : '?') + extraQuery;
  }

  try {
    // Admin Page HTML Server: /admin or /admin.html
    if (action === 'admin-page' || rawUrl.includes('/admin') && !rawUrl.includes('/api/admin/')) {
      try {
        const filePath = path.join(process.cwd(), 'admin.html');
        if (fs.existsSync(filePath)) {
          const html = fs.readFileSync(filePath, 'utf8');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.statusCode = 200;
          res.end(html);
          return;
        }
      } catch (err) {}

      // Embedded fallback if file read is not supported in environment
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.statusCode = 200;
      res.end(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/admin.html"></head><body>Redirecting to Admin...</body></html>`);
      return;
    }

    // Status / Health Check Endpoint
    if (action === 'status' || rawUrl.includes('status')) {
      const hasGemini = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
      const hasEvoServer = !!(process.env.EVOLUTION_SERVER || process.env.EVOLUTION_URL || process.env.EVOLUTION_API_URL);
      const hasEvoKey = !!(process.env.EVOLUTION_KEY || process.env.EVOLUTION_API_KEY || process.env.GLOBAL_API_KEY);
      return sendJson(res, 200, {
        status: 'online',
        geminiConfigured: hasGemini,
        evolutionServerConfigured: hasEvoServer,
        evolutionKeyConfigured: hasEvoKey,
        evolutionServer: getEvolutionServer()
      });
    }

    if (action === 'debug-gemini' || rawUrl.includes('debug-gemini')) {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
      const payload = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Hello, testing connection.' }] }]
      });

      const tests = [
        { version: 'v1beta', model: 'gemini-3.6-flash' },
        { version: 'v1beta', model: 'gemini-2.5-flash' },
        { version: 'v1beta', model: 'gemini-2.5-pro' },
        { version: 'v1beta', model: 'gemini-1.5-flash-8b' },
        { version: 'v1beta', model: 'gemini-1.5-flash-002' },
        { version: 'v1beta', model: 'gemini-1.5-pro-002' }
      ];

      const results = {};
      for (const t of tests) {
        try {
          const r = await makeGeminiRequest(key, t.version, t.model, payload);
          results[`${t.version}/${t.model}`] = { success: true, reply: r };
        } catch (e) {
          results[`${t.version}/${t.model}`] = { success: false, error: e.message };
        }
      }

      return sendJson(res, 200, { keyConfigured: !!key, keyLength: key.length, results });
    }

    // 1. Evolution API Proxy: /api/evo/*
    if (action === 'evo' || rawUrl.includes('/api/evo/') || rawUrl.includes('/evo/')) {
      const evoPath = pathParam || rawUrl.replace(/.*\/api\/evo/, '');
      const evoServer = getEvolutionServer(req.headers['x-evo-server']);
      const evoKey = getEvolutionKey(req.headers['x-evo-key']);

      const bodyData = req.method !== 'GET' ? await getBody(req) : null;
      const result = await forwardToEvolution(evoServer, evoKey, req.method, evoPath, bodyData);
      return sendJson(res, result.status || 200, result.data || { error: result.error });
    }

    // 2. Webhook endpoint: /api/webhook/ai-agent/:instanceName
    if (action === 'webhook' || rawUrl.includes('/api/webhook/ai-agent/')) {
      const instanceName = decodeURIComponent(instanceParam || rawUrl.split('/api/webhook/ai-agent/')[1]?.split('?')[0] || '');
      const eventData = await getBody(req);

      console.log(`[Incoming Webhook] [${instanceName}] Event:`, eventData.event);

      const isMessageUpsert = !eventData.event || /messages[\._]upsert/i.test(eventData.event);

      if (isMessageUpsert && eventData.data) {
        const msgObj = Array.isArray(eventData.data) ? eventData.data[0] : eventData.data;
        const isFromMe = msgObj?.key?.fromMe;
        const remoteJid = msgObj?.key?.remoteJid || '';

        // Track human operator manual outgoing messages from WhatsApp
        if (isFromMe && remoteJid && !remoteJid.includes('@broadcast') && !remoteJid.includes('status@broadcast')) {
          const customerPhone = remoteJid.split('@')[0].replace(/[^0-9]/g, '');
          if (customerPhone) {
            recordHumanIntervention(instanceName, customerPhone);
          }
          return sendJson(res, 200, { status: 'human_outgoing_tracked' });
        }

        if (!isFromMe && !remoteJid.includes('@broadcast') && !remoteJid.includes('status@broadcast')) {
          const userText = msgObj?.message?.conversation || 
                           msgObj?.message?.extendedTextMessage?.text || 
                           msgObj?.message?.imageMessage?.caption || 
                           msgObj?.message?.buttonsResponseMessage?.selectedButtonId || '';

          if (userText && userText.trim().length > 0) {
            const senderPhone = remoteJid.split('@')[0].replace(/[^0-9]/g, '');
            console.log(`[WhatsApp Incoming] [${instanceName}] from ${senderPhone}: "${userText}"`);

            // ==================== HUMAN INTERVENTION / TAKEOVER GUARD ====================
            // If the human operator manually intervened and messaged this customer, pause AI auto-replies for 24 hours
            if (isHumanIntervened(instanceName, senderPhone)) {
              console.log(`[Human Takeover Active] [${instanceName}] Skipping AI auto-reply for ${senderPhone} because a human recently responded.`);
              return sendJson(res, 200, { status: 'human_takeover_active', message: 'AI paused due to human operator intervention' });
            }

            // Retrieve persistent bot configuration
            const botConfig = getEffectiveConfig(instanceName);

            // If the bot has been explicitly turned OFF via toggle, ignore auto-reply
            if (botConfig.enabled === false) {
              console.log(`[WhatsApp Incoming] [${instanceName}] Bot is currently set to INACTIVE/PAUSED. Skipping auto-reply.`);
              return sendJson(res, 200, { status: 'bot_paused' });
            }

            const businessName = botConfig.businessName || 'Our Business';

            // ==================== SAAS TRIAL MODE RESTRICTION GUARD ====================
            // Trial users can only test with their own registered/submitted WhatsApp phone number
            const userPlan = botConfig.plan || 'trial';
            const ownerPhone = (botConfig.phone || '').replace(/\D/g, '');
            const allowedTestPhone = (botConfig.allowedTestPhone || '').replace(/\D/g, '');

            const isAuthorizedTester = userPlan === 'pro' || userPlan === 'active' || (
              (!ownerPhone && !allowedTestPhone) ||
              (ownerPhone && (senderPhone === ownerPhone || senderPhone.endsWith(ownerPhone) || ownerPhone.endsWith(senderPhone))) ||
              (allowedTestPhone && (senderPhone === allowedTestPhone || senderPhone.endsWith(allowedTestPhone) || allowedTestPhone.endsWith(senderPhone)))
            );

            if (!isAuthorizedTester) {
              console.log(`[Trial Guard] [${instanceName}] Blocked message from external user ${senderPhone} (Trial plan restricted to owner: ${ownerPhone || allowedTestPhone})`);
              
              const trialNotice = `👋 *${businessName} — BotFlow AI Notice*\n\nThis WhatsApp AI assistant is currently in *Private Trial Testing Mode* authorized only for the account owner.\n\nTo unlock 24/7 public customer responses for all incoming numbers, please upgrade to a full plan at your BotFlow dashboard.`;
              
              const evoServer = getEvolutionServer(botConfig.serverUrl);
              const evoKey = getEvolutionKey(req.headers['apikey'] || botConfig.serverKey);
              
              forwardToEvolution(evoServer, evoKey, 'POST', `/message/sendText/${encodeURIComponent(instanceName)}`, {
                number: senderPhone,
                text: trialNotice
              }).catch(e => console.warn('[Trial Notice Error]:', e.message));

              return sendJson(res, 200, { status: 'trial_restricted', message: 'Sender not authorized in trial mode' });
            }

            // Retrieve customer chat history for multi-turn memory
            const history = getCustomerHistory(instanceName, senderPhone);

            // High-EQ Master Prompt for Gemini
            const systemPrompt = `You are a warm, attentive, and highly professional human customer service assistant working directly for "${businessName}".
Your goal is to converse naturally on WhatsApp, providing personalized, helpful, and memorable assistance.

BUSINESS KNOWLEDGE & PRICING:
${botConfig.faqs || 'We are a dedicated professional business providing quality services. Help the customer with whatever they need.'}

ESSENTIAL RULES:
1. Real Human Scheduling & Awareness:
   - Check user requests against our business hours (e.g. Mon-Sat 9:00 AM - 6:00 PM, Closed Sundays).
   - If a customer requests an appointment when closed (e.g., Sunday or outside working hours), politely and empathetically decline: "Sorry [Name], we are closed on Sundays! Our hours are Mon-Sat 9AM-6PM. Could we do Monday or another weekday instead?"
   - Never dump raw FAQ text or robotic lists when a simple conversational reply is needed.
2. Personalization & Name Recognition:
   - When the customer shares their name, warmly address them by their name.
   - Use their name naturally in subsequent replies.
3. WhatsApp Format:
   - Keep answers clear, conversational, and concise (typically 2 to 4 sentences).
   - Use bullet points (•) and *bold* text for readability.`;

            // Call Google Gemini Flash with full conversation history
            const aiReply = await callGeminiWithHistory(
              botConfig.geminiKey,
              systemPrompt,
              history,
              userText,
              businessName,
              botConfig.faqs
            );

            console.log(`[AI Response] [${instanceName}] replying to ${senderPhone}: "${aiReply}"`);

            // Save user and bot responses to multi-turn memory
            addToHistory(instanceName, senderPhone, 'user', userText);
            addToHistory(instanceName, senderPhone, 'model', aiReply);

            const evoServer = getEvolutionServer(botConfig.serverUrl);
            const evoKey = getEvolutionKey(req.headers['apikey'] || botConfig.serverKey);

            // ==================== ANTI-BAN PROTECTION ENGINE ====================
            // 1. Calculate natural human reading & typing delay (1.5s to 3.5s)
            const baseDelay = Math.floor(Math.random() * 1000) + 1500; // 1500ms - 2500ms
            const lengthFactor = Math.min(1000, Math.floor(aiReply.length * 8)); // Scaled by reply length
            const naturalDelay = Math.min(3500, baseDelay + lengthFactor); // Hard capped at 3500ms

            console.log(`[Anti-Ban Protection] [${instanceName}] Simulating human typing presence for ${naturalDelay}ms to ${senderPhone}...`);

            // 2. Send live "composing..." typing status to WhatsApp
            forwardToEvolution(evoServer, evoKey, 'POST', `/chat/sendPresence/${encodeURIComponent(instanceName)}`, {
              number: senderPhone,
              presence: 'composing',
              delay: naturalDelay
            }).catch(e => console.warn('[Anti-Ban Presence]:', e.message));

            // 3. Wait the human typing duration before sending message
            await new Promise(r => setTimeout(r, naturalDelay));

            // Media attachment detection with Google Drive auto-transform
            const lowerMsg = userText.toLowerCase();
            let rawMedia = null;

            if (/(store|office|location|address|map|shop|where|place)/i.test(lowerMsg) && botConfig.locationMediaUrl) {
              rawMedia = botConfig.locationMediaUrl;
            } else if (/(price|pricing|catalog|catalogue|brochure|portfolio|sample|menu|photo|pic)/i.test(lowerMsg) && botConfig.catalogMediaUrl) {
              rawMedia = botConfig.catalogMediaUrl;
            } else if (/(hi|hello|hey|welcome|start)/i.test(lowerMsg) && botConfig.welcomeMediaUrl && history.length <= 2) {
              rawMedia = botConfig.welcomeMediaUrl;
            }

            const directMediaUrl = cleanMediaUrl(rawMedia);

            // Record bot outgoing timestamp to distinguish from human operator manual typing
            recordBotSent(instanceName, senderPhone);

            if (directMediaUrl) {
              const { mediatype, mimetype } = getMediaTypeAndMime(directMediaUrl);
              console.log(`[Sending Media] ${mediatype} from ${directMediaUrl}`);
              
              await forwardToEvolution(evoServer, evoKey, 'POST', `/message/sendMedia/${encodeURIComponent(instanceName)}`, {
                number: senderPhone,
                mediatype,
                mimetype,
                caption: aiReply,
                media: directMediaUrl,
                fileName: `media_attachment.${mediatype === 'document' ? 'pdf' : (mediatype === 'video' ? 'mp4' : 'jpg')}`
              });
            } else {
              // Standard Text Message with anti-ban delay
              await forwardToEvolution(evoServer, evoKey, 'POST', `/message/sendText/${encodeURIComponent(instanceName)}`, {
                number: senderPhone,
                text: aiReply,
                delay: 0
              });
            }
          }
        }
      }

      return sendJson(res, 200, { status: 'received' });
    }

    // 3. Save / Toggle Bot Configuration: POST /api/bot-config
    // Also auto-re-registers webhook on Evolution API to ensure durability and syncs to Supabase
    if (action === 'bot-config' && req.method === 'POST') {
      const data = await getBody(req);
      if (data.instanceName) {
        const existing = getEffectiveConfig(data.instanceName);
        const updated = { ...existing, ...data };
        memoryConfigs[data.instanceName] = updated;
        persistentInstanceRegistry[data.instanceName] = updated;

        // Auto-sync user & bot config to Supabase Postgres database (fire-and-forget)
        syncToSupabase(updated).catch(e => console.warn('[Supabase Sync Error]:', e.message));

        // Auto-register webhook on Evolution API (fire-and-forget for speed)
        const evoServer = getEvolutionServer(updated.serverUrl);
        const evoKey = getEvolutionKey(updated.serverKey);
        const webhookUrl = data.webhookUrl || `https://wsbot-jade.vercel.app/api/webhook/ai-agent/${encodeURIComponent(data.instanceName)}`;

        // Fire-and-forget webhook registration (don't block the response)
        forwardToEvolution(evoServer, evoKey, 'POST', `/webhook/set/${encodeURIComponent(data.instanceName)}`, {
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: false,
            events: ["MESSAGES_UPSERT"]
          }
        }).then(r => {
          console.log(`[Auto-Webhook] Re-registered webhook for ${data.instanceName}:`, r.status);
        }).catch(e => {
          console.warn(`[Auto-Webhook] Failed to register webhook: ${e.message}`);
        });

        return sendJson(res, 200, { success: true, config: updated });
      }
      return sendJson(res, 400, { error: 'instanceName is required' });
    }

    // 4. Get Bot Configuration: GET /api/bot-config?instance=...
    if (action === 'bot-config' && req.method === 'GET') {
      const instanceName = parsedUrl.searchParams.get('instance') || 'default';
      const config = getEffectiveConfig(instanceName);
      return sendJson(res, 200, config);
    }

    // 4b. Ensure Webhook: POST /api/ensure-webhook
    // Explicitly re-registers webhook on Evolution API — called on every page load
    if (action === 'ensure-webhook' && req.method === 'POST') {
      const data = await getBody(req);
      const instanceName = data.instanceName;
      if (!instanceName) return sendJson(res, 400, { error: 'instanceName required' });

      const config = getEffectiveConfig(instanceName);
      const evoServer = getEvolutionServer(data.serverUrl || config.serverUrl);
      const evoKey = getEvolutionKey(data.serverKey || config.serverKey);
      const webhookUrl = data.webhookUrl || `https://wsbot-jade.vercel.app/api/webhook/ai-agent/${encodeURIComponent(instanceName)}`;

      try {
        const result = await forwardToEvolution(evoServer, evoKey, 'POST', `/webhook/set/${encodeURIComponent(instanceName)}`, {
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: false,
            events: ["MESSAGES_UPSERT"]
          }
        });

        // Optimization: Disable history sync & status reading on Evolution API to save VPS disk & RAM
        forwardToEvolution(evoServer, evoKey, 'POST', `/settings/set/${encodeURIComponent(instanceName)}`, {
          rejectCall: false,
          msgRetryCounterCache: false,
          alwaysOnline: true,
          readMessages: true,
          readStatus: false,
          syncFullHistory: false,
          groupsIgnore: true
        }).catch(e => console.warn('[Settings Error]:', e.message));

        console.log(`[Ensure-Webhook] Result for ${instanceName}:`, result.status);
        return sendJson(res, 200, { success: true, webhookUrl, evoStatus: result.status, result: result.data });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    }

    // ==================== ADMIN API ROUTES ====================

    // Admin Login: POST /api/admin/login
    if ((action === 'admin-login' || rawUrl.includes('/api/admin/login')) && req.method === 'POST') {
      const { username, password } = await getBody(req);
      if (username === 'robbin' && password === 'Robbin#15') {
        return sendJson(res, 200, {
          success: true,
          token: 'robbin_admin_session_auth_2026',
          user: { username: 'robbin', role: 'Super Admin' }
        });
      }
      return sendJson(res, 401, { error: 'Invalid username or password' });
    }

    // Admin Get All Users: GET /api/admin/users
    if (action === 'admin-users' || rawUrl.includes('/api/admin/users')) {
      const authHeader = req.headers['authorization'] || '';
      const queryToken = parsedUrl.searchParams.get('token') || '';
      const isAuthed = authHeader.includes('robbin_admin_session_auth_2026') || queryToken === 'robbin_admin_session_auth_2026';

      if (!isAuthed) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required' });
      }

      // 1. Fetch Supabase registered users
      const dbUsers = await getSupabaseUsers();

      // 2. Fetch Evolution API live instances
      const evoServer = getEvolutionServer();
      const evoKey = getEvolutionKey();
      const evoRes = await forwardToEvolution(evoServer, evoKey, 'GET', '/instance/fetchInstances');
      const evoInstances = Array.isArray(evoRes.data) ? evoRes.data : [];

      // 3. Merge data from Supabase, Evolution API, and persistent registry
      const userMap = {};

      // Seed with persistent registry
      for (const [k, v] of Object.entries(persistentInstanceRegistry)) {
        userMap[k] = {
          instanceName: k,
          businessName: v.businessName || 'Avadaspace Design LLC',
          phone: '919198747810',
          email: 'contact@avadaspace.com',
          faqs: v.faqs || '',
          locationMediaUrl: v.locationMediaUrl || '',
          catalogMediaUrl: v.catalogMediaUrl || '',
          welcomeMediaUrl: v.welcomeMediaUrl || '',
          enabled: v.enabled !== false,
          connectionStatus: 'open',
          source: 'Persistent Registry',
          updatedAt: new Date().toISOString()
        };
      }

      // Merge Supabase DB entries
      for (const row of dbUsers) {
        const id = row.instance_name;
        if (id) {
          userMap[id] = {
            ...(userMap[id] || {}),
            instanceName: id,
            businessName: row.business_name || userMap[id]?.businessName || 'Business',
            phone: row.phone || userMap[id]?.phone || '',
            email: row.email || userMap[id]?.email || '',
            faqs: row.faqs || userMap[id]?.faqs || '',
            locationMediaUrl: row.location_media_url || userMap[id]?.locationMediaUrl || '',
            catalogMediaUrl: row.catalog_media_url || userMap[id]?.catalogMediaUrl || '',
            welcomeMediaUrl: row.welcome_media_url || userMap[id]?.welcomeMediaUrl || '',
            enabled: row.enabled !== false,
            source: 'Supabase DB',
            updatedAt: row.updated_at || userMap[id]?.updatedAt
          };
        }
      }

      // Merge Evolution API live statuses
      for (const inst of evoInstances) {
        const instName = inst.name || inst.instance?.instanceName;
        if (instName) {
          const rawStatus = inst.connectionStatus || inst.state || inst.instance?.state || inst.status || 'unknown';
          const instPhone = inst.number || (inst.ownerJid || '').replace(/\D/g, '');
          const profile = inst.profileName || inst.name;

          userMap[instName] = {
            ...(userMap[instName] || {
              instanceName: instName,
              businessName: profile || 'WhatsApp User',
              email: '',
              faqs: memoryConfigs[instName]?.faqs || '- Professional Business Assistance',
              enabled: memoryConfigs[instName]?.enabled !== false
            }),
            phone: instPhone || userMap[instName]?.phone || '',
            profileName: profile,
            connectionStatus: rawStatus === 'open' ? 'open' : rawStatus,
            profilePicUrl: inst.profilePicUrl || null,
            createdAt: inst.createdAt || null
          };
        }
      }

      const allUsers = Object.values(userMap);
      return sendJson(res, 200, {
        success: true,
        count: allUsers.length,
        users: allUsers,
        server: evoServer
      });
    }

    // Admin Toggle Bot Status: POST /api/admin/toggle-bot
    if ((action === 'admin-toggle-bot' || rawUrl.includes('/api/admin/toggle-bot')) && req.method === 'POST') {
      const { instanceName, enabled } = await getBody(req);
      if (instanceName) {
        const cfg = getEffectiveConfig(instanceName);
        cfg.enabled = !!enabled;
        memoryConfigs[instanceName] = cfg;
        persistentInstanceRegistry[instanceName] = cfg;
        syncToSupabase(cfg).catch(() => {});
        return sendJson(res, 200, { success: true, instanceName, enabled: cfg.enabled });
      }
      return sendJson(res, 400, { error: 'instanceName required' });
    }

    // 6. Auto-Reconnection Worker & Self-Healing Cron: /api/cron-reconnect
    if (action === 'cron-reconnect' || rawUrl.includes('/cron-reconnect') || rawUrl.includes('/cron/reconnect')) {
      const evoServer = getEvolutionServer();
      const evoKey = getEvolutionKey();
      
      const instancesRes = await forwardToEvolution(evoServer, evoKey, 'GET', '/instance/fetchInstances');
      const instances = Array.isArray(instancesRes.data) ? instancesRes.data : [];
      
      const results = [];
      let reconnectedCount = 0;

      for (const inst of instances) {
        const instName = inst.name || inst.instance?.instanceName;
        const status = inst.connectionStatus || inst.state || inst.instance?.state || inst.status;

        if (instName && (status === 'close' || status === 'connecting' || status === 'closed')) {
          console.log(`[Auto-Reconnect Worker] Re-establishing disconnected instance: ${instName} (current state: ${status})`);
          try {
            const reconnectRes = await forwardToEvolution(evoServer, evoKey, 'GET', `/instance/connect/${encodeURIComponent(instName)}`);
            results.push({ instance: instName, previousState: status, reconnected: true, result: reconnectRes.status });
            reconnectedCount++;
          } catch (e) {
            results.push({ instance: instName, previousState: status, error: e.message });
          }
        } else {
          results.push({ instance: instName, state: status, healthy: true });
        }
      }

      return sendJson(res, 200, {
        success: true,
        worker: 'BotFlow Self-Healing Auto-Reconnection Cron',
        totalChecked: instances.length,
        reconnectedCount,
        timestamp: new Date().toISOString(),
        details: results
      });
    }

    // 7. Auth: Send Email OTP: POST /api/auth/send-otp
    if (action === 'auth-send-otp' || action === 'auth/send-otp' || rawUrl.includes('/api/auth/send-otp')) {
      const { email } = await getBody(req);
      if (!email || !email.includes('@')) {
        return sendJson(res, 400, { error: 'Please enter a valid email address' });
      }
      const otpRes = await sendSupabaseOtp(email);
      if (otpRes.status >= 400) {
        return sendJson(res, otpRes.status, { error: otpRes.data?.msg || otpRes.data?.error_description || 'Failed to send OTP' });
      }
      return sendJson(res, 200, { success: true, message: `6-digit verification code sent to ${email}` });
    }

    // 8. Auth: Verify Email OTP: POST /api/auth/verify-otp
    if (action === 'auth-verify-otp' || action === 'auth/verify-otp' || rawUrl.includes('/api/auth/verify-otp')) {
      const { email, otp } = await getBody(req);
      if (!email || !otp) {
        return sendJson(res, 400, { error: 'Email and verification OTP code are required' });
      }
      const verifyRes = await verifySupabaseOtp(email, otp);
      if (verifyRes.status >= 400) {
        return sendJson(res, verifyRes.status, { error: verifyRes.data?.msg || verifyRes.data?.error_description || 'Invalid or expired verification code' });
      }

      // Fetch user's isolated bot instances from Supabase database
      const cleanEmail = email.trim().toLowerCase();
      const allUsers = await getSupabaseUsers();
      const userBots = allUsers.filter(u => (u.email || '').toLowerCase() === cleanEmail);
      
      const sessionUser = {
        email: cleanEmail,
        userId: verifyRes.data?.user?.id || 'usr_' + Buffer.from(cleanEmail).toString('hex').slice(0, 10),
        token: verifyRes.data?.access_token || 'tok_' + Date.now(),
        bots: userBots
      };

      // Match primary bot or fallback to persistent registry if matched
      let matchedInstance = userBots[0] || null;
      if (!matchedInstance) {
        for (const [k, v] of Object.entries(persistentInstanceRegistry)) {
          if (cleanEmail.includes('avada') || cleanEmail.includes('shagun') || cleanEmail.includes('bhavesh') || cleanEmail.includes('robbin')) {
            matchedInstance = {
              instanceName: k,
              businessName: v.businessName,
              phone: '919198747810',
              email: cleanEmail
            };
            break;
          }
        }
      }

      return sendJson(res, 200, {
        success: true,
        user: sessionUser,
        matchedBot: matchedInstance
      });
    }

    // 5. Test Chat with Multi-Turn History: POST /api/test-chat
    if (action === 'test-chat' && req.method === 'POST') {
      const data = await getBody(req);
      const businessName = data.businessName || 'Our Business';
      const userMessage = data.message || 'Hi';
      const history = data.history || [];

      const systemPrompt = `You are a warm, attentive, and highly professional human customer service assistant working directly for "${businessName}".
Your goal is to converse naturally on WhatsApp, providing personalized, helpful, and memorable assistance.

BUSINESS KNOWLEDGE & PRICING:
${data.faqs || 'We are a dedicated professional business providing quality services.'}

ESSENTIAL RULES:
1. Real Human Scheduling & Awareness:
   - Check user requests against our business hours (e.g. Mon-Sat 9:00 AM - 6:00 PM, Closed Sundays).
   - If a customer requests an appointment when closed (e.g., Sunday or outside working hours), politely and empathetically decline: "Sorry [Name], we are closed on Sundays! Our hours are Mon-Sat 9AM-6PM. Could we do Monday or another weekday instead?"
   - Never dump raw FAQ text or robotic lists when a simple conversational reply is needed.
2. Personalization & Name Recognition:
   - When the customer shares their name, warmly address them by their name.
   - Use their name naturally in subsequent replies.
3. WhatsApp Format:
   - Keep answers conversational, clear, and concise (2-4 sentences).`;

      const reply = await callGeminiWithHistory(
        data.geminiKey, 
        systemPrompt, 
        history, 
        userMessage, 
        businessName, 
        data.faqs
      );

      // Media attachment preview in simulator
      const lowerMsg = userMessage.toLowerCase();
      let rawMedia = null;
      if (/(store|office|location|address|map|shop|where|place)/i.test(lowerMsg) && data.locationMediaUrl) {
        rawMedia = data.locationMediaUrl;
      } else if (/(price|pricing|catalog|catalogue|brochure|portfolio|sample|menu|photo|pic)/i.test(lowerMsg) && data.catalogMediaUrl) {
        rawMedia = data.catalogMediaUrl;
      } else if (/(hi|hello|hey|welcome|start)/i.test(lowerMsg) && data.welcomeMediaUrl && history.length === 0) {
        rawMedia = data.welcomeMediaUrl;
      }

      const mediaUrl = cleanMediaUrl(rawMedia);

      return sendJson(res, 200, { reply, mediaUrl });
    }

    return sendJson(res, 200, { status: 'BotFlow Self-Healing Gemini AI Live' });

  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
