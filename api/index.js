import https from 'https';
import http from 'http';
import { URL, URLSearchParams } from 'url';

// Default persistent configurations for client instances (survives cold starts & server restarts)
const persistentDefaults = {
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
    enabled: true
  }
};

// Global in-memory storage for serverless runtime initialized with persistent defaults
const memoryConfigs = { ...persistentDefaults };

function getEffectiveConfig(instanceName) {
  if (memoryConfigs[instanceName]) return memoryConfigs[instanceName];
  if (persistentDefaults[instanceName]) return persistentDefaults[instanceName];
  
  // Clean fallback for any newly created instance
  const cleanName = (instanceName || 'Our Business')
    .replace(/_[a-z0-9]+_\d+$/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  return {
    instanceName: instanceName || 'default',
    businessName: cleanName,
    faqs: `- Business Name: ${cleanName}
- Business Hours: Mon-Sat 9:00 AM - 6:00 PM (Closed on Sundays)
- Services: Professional services and consultations
- Booking: Reply here to schedule an appointment`,
    enabled: true
  };
}

// Multi-turn conversation history cache keyed by: `${instanceName}:${senderId}`
const conversationHistories = {};

function getCustomerHistory(instanceName, senderId) {
  const key = `${instanceName}:${senderId}`;
  if (!conversationHistories[key]) {
    conversationHistories[key] = [];
  }
  return conversationHistories[key];
}

function addToHistory(instanceName, senderId, role, text) {
  const key = `${instanceName}:${senderId}`;
  if (!conversationHistories[key]) {
    conversationHistories[key] = [];
  }
  conversationHistories[key].push({
    role: role === 'user' ? 'user' : 'model',
    parts: [{ text: text }]
  });
  if (conversationHistories[key].length > 14) {
    conversationHistories[key] = conversationHistories[key].slice(-14);
  }
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
    // Status / Health Check Endpoint
    if (action === 'status' || rawUrl.includes('status')) {
      const hasKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
      return sendJson(res, 200, {
        status: 'online',
        geminiConfigured: hasKey,
        keyLength: hasKey ? (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY).length : 0
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
      const evoServer = req.headers['x-evo-server'] || process.env.EVOLUTION_SERVER || 'https://evolution-api-2gki.srv1722699.hstgr.cloud';
      const evoKey = req.headers['x-evo-key'] || process.env.EVOLUTION_KEY || '429683C4C977415CAAFCCE10F7D57E11';

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

        if (!isFromMe && !remoteJid.includes('@broadcast') && !remoteJid.includes('status@broadcast')) {
          const userText = msgObj?.message?.conversation || 
                           msgObj?.message?.extendedTextMessage?.text || 
                           msgObj?.message?.imageMessage?.caption || 
                           msgObj?.message?.buttonsResponseMessage?.selectedButtonId || '';

          if (userText && userText.trim().length > 0) {
            const senderPhone = remoteJid.split('@')[0].replace(/[^0-9]/g, '');
            console.log(`[WhatsApp Incoming] [${instanceName}] from ${senderPhone}: "${userText}"`);

            // Retrieve persistent bot configuration for this instance
            const botConfig = getEffectiveConfig(instanceName);
            const businessName = botConfig.businessName || 'Our Business';

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

            const evoServer = botConfig.serverUrl || process.env.EVOLUTION_SERVER || 'https://evolution-api-2gki.srv1722699.hstgr.cloud';
            const evoKey = req.headers['apikey'] || botConfig.serverKey || process.env.EVOLUTION_KEY || '429683C4C977415CAAFCCE10F7D57E11';

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
              // Standard Text Message
              await forwardToEvolution(evoServer, evoKey, 'POST', `/message/sendText/${encodeURIComponent(instanceName)}`, {
                number: senderPhone,
                text: aiReply,
                delay: 1000
              });
            }
          }
        }
      }

      return sendJson(res, 200, { status: 'received' });
    }

    // 3. Save Bot Configuration: POST /api/bot-config
    if (action === 'bot-config' && req.method === 'POST') {
      const data = await getBody(req);
      if (data.instanceName) {
        memoryConfigs[data.instanceName] = { ...(memoryConfigs[data.instanceName] || {}), ...data };
        persistentDefaults[data.instanceName] = { ...(persistentDefaults[data.instanceName] || {}), ...data };
        return sendJson(res, 200, { success: true, config: memoryConfigs[data.instanceName] });
      }
      return sendJson(res, 400, { error: 'instanceName is required' });
    }

    // 4. Get Bot Configuration: GET /api/bot-config?instance=...
    if (action === 'bot-config' && req.method === 'GET') {
      const instanceName = parsedUrl.searchParams.get('instance') || 'default';
      const config = getEffectiveConfig(instanceName);
      return sendJson(res, 200, config);
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

    return sendJson(res, 200, { status: 'BotFlow Context-Aware Gemini AI Live' });

  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
