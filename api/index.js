import https from 'https';
import http from 'http';
import { URL, URLSearchParams } from 'url';

// Global in-memory storage for serverless runtime
const memoryConfigs = {};

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

// Intelligent Context-Aware Conversational Fallback Engine
function generateSmartReply(userMessage, businessName, faqs, conversationHistory = []) {
  const msg = (userMessage || '').trim();
  const lower = msg.toLowerCase();
  const bName = businessName || 'our team';
  const faqText = faqs || '';

  // Extract customer name from conversation history if available
  let detectedName = '';
  for (const turn of conversationHistory) {
    const txt = turn.parts?.[0]?.text || '';
    const m = txt.match(/(?:my name is|i am|i'm|this is|call me|meet you,)\s+([A-Za-z]+)/i);
    if (m && m[1] && m[1].toLowerCase() !== 'bname') {
      detectedName = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      break;
    }
  }

  // 1. Direct Name Introduction: "My name is X", "I am X", "I'm X"
  const nameMatch = msg.match(/(?:my name is|i am|i'm|this is|call me)\s+([A-Za-z]+)/i);
  if (nameMatch && nameMatch[1]) {
    detectedName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
    return `Nice to meet you, ${detectedName}! 👋 Welcome to *${bName}*.\n\nHow can I help you today? Feel free to ask about our services, pricing, hours, or booking an appointment!`;
  }

  const greetingName = detectedName ? `, ${detectedName}` : '';

  // 2. Conversational Acknowledgements: "okay", "ok", "sure", "alright", "yes", "cool", "sounds good", "got it"
  if (/^(ok|okay|k|sure|alright|all right|yes|yeah|yep|cool|sounds good|got it|done|perfect|great)$/i.test(lower)) {
    // Check if the previous bot message was asking for appointment/booking time
    const lastBotMsg = conversationHistory.slice().reverse().find(t => t.role === 'model')?.parts?.[0]?.text || '';
    if (/(book|date|time|appointment|schedule|slot)/i.test(lastBotMsg)) {
      return `Awesome${greetingName}! What day and time works best for you? (e.g., Tomorrow at 3:00 PM). Let me know and I'll confirm it for you! 😊`;
    }
    return `Great${greetingName}! Let me know what you'd like to do next or if you have any questions about our services!`;
  }

  // 3. Thank you / Appreciation
  if (/(thank|thanks|thx|appreciate|grateful)/i.test(lower)) {
    return `You're very welcome${greetingName}! 😊 Feel free to message anytime if you need anything else. Have a wonderful day!`;
  }

  // 4. Greetings
  if (/^(hi|hello|hey|hola|namaste|good\s*(morning|afternoon|evening)|start|help|test)$/i.test(lower)) {
    return `Hey there${greetingName}! 👋 Welcome to *${bName}*. How can I assist you today? Feel free to ask about our services, pricing, or hours!`;
  }

  // 5. Booking / Appointment / Schedule
  if (/(book|appointment|schedule|slot|reserve|visit)/i.test(lower)) {
    const lines = faqText.split('\n').filter(l => /(book|cal\.com|calendly|link|appointment|visit)/i.test(l));
    if (lines.length > 0) {
      return `📅 *Booking an Appointment with ${bName}:*\n\n${lines.join('\n')}\n\nWhat day and time work best for you${greetingName}? Just message your preferred slot here!`;
    }
    return `📅 I'd be delighted to book an appointment for you${greetingName}! What day and time work best for you?`;
  }

  // 6. Location / Address / Store Photo / Where
  if (/(location|address|where|direction|city|map|store|office|shop)/i.test(lower)) {
    const lines = faqText.split('\n').filter(l => /(location|address|street|suite|road|floor|map|office|city)/i.test(l));
    if (lines.length > 0) {
      return `📍 *Our Location:*\n${lines.join('\n')}\n\nLet me know if you need driving directions or landmarks${greetingName}!`;
    }
    return `📍 We are located at Main Office Suite 400. Let me know if you need driving directions${greetingName}!`;
  }

  // 7. Pricing / Cost / Rates / Catalog / Portfolio
  if (/(price|pricing|cost|how\s*much|rate|charges|fee|catalog|catalogue|brochure|portfolio|sample|package)/i.test(lower)) {
    const lines = faqText.split('\n').filter(l => /(price|pricing|cost|\$|₹|fee|clean|whiten|consult|service|rate|package)/i.test(l));
    if (lines.length > 0) {
      return `💰 *Pricing & Services for ${bName}:*\n\n${lines.join('\n')}\n\nWhich of these can I help you with${greetingName}? 😊`;
    }
    return `💰 Our packages typically range from $50 for consultations up to $150-$400 for complete projects. Let me know what you need${greetingName}!`;
  }

  // 8. Hours / Timing / When open
  if (/(hour|timing|time|open|close|when\s*are\s*you|sunday|monday|saturday|weekend)/i.test(lower)) {
    const lines = faqText.split('\n').filter(l => /(hour|timing|open|close|mon|tue|wed|thu|fri|sat|sun|am|pm)/i.test(l));
    if (lines.length > 0) {
      return `🕒 *Business Hours for ${bName}:*\n\n${lines.join('\n')}\n\nFeel free to reach out or drop by during these times!`;
    }
    return `🕒 We're open Monday to Saturday from 9:00 AM to 6:00 PM (Closed on Sundays).`;
  }

  // 9. Natural Follow-up Fallback
  return `I'm here to help${greetingName}! 😊 You can tell me what service you're looking for, or ask about our *pricing*, *timings*, or *booking a slot*. How can I best assist you?`;
}

// Google Gemini Flash AI Engine with Multi-Turn Memory & Persona
function callGeminiWithHistory(apiKey, systemPrompt, conversationHistory, currentUserMessage, businessName, faqs) {
  return new Promise((resolve) => {
    const key = apiKey || process.env.GEMINI_API_KEY;

    if (!key) {
      return resolve(generateSmartReply(currentUserMessage, businessName, faqs, conversationHistory));
    }

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
        maxOutputTokens: 300,
        temperature: 0.7,
        topP: 0.95
      }
    });

    const modelName = 'gemini-1.5-flash';
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(key)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const reply = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply && reply.trim().length > 0) {
            resolve(reply.trim());
          } else {
            resolve(generateSmartReply(currentUserMessage, businessName, faqs, conversationHistory));
          }
        } catch (e) {
          resolve(generateSmartReply(currentUserMessage, businessName, faqs, conversationHistory));
        }
      });
    });

    req.on('error', () => resolve(generateSmartReply(currentUserMessage, businessName, faqs, conversationHistory)));
    req.write(payload);
    req.end();
  });
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
    // 1. Evolution API Proxy: /api/evo/*
    if (action === 'evo' || rawUrl.includes('/api/evo/')) {
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

            const botConfig = memoryConfigs[instanceName] || {};
            const businessName = botConfig.businessName || instanceName.replace(/_/g, ' ') || 'Our Business';

            // Retrieve customer chat history for multi-turn memory
            const history = getCustomerHistory(instanceName, senderPhone);

            // High-EQ Master Prompt for Gemini
            const systemPrompt = `You are a warm, attentive, and highly professional human customer service assistant working directly for "${businessName}".
Your goal is to converse naturally on WhatsApp, providing personalized, helpful, and memorable assistance.

BUSINESS KNOWLEDGE & PRICING:
${botConfig.faqs || 'We are a dedicated professional business providing quality services. Help the customer with whatever they need.'}

ESSENTIAL RULES:
1. Real Human Dialogue:
   - When the user says casual acknowledgments like "ok", "okay", "sure", or "sounds good", respond naturally in context of the previous message (e.g. asking for their preferred time or clarifying their request).
   - Never sound like an automated answering machine repeating generic scripts.
2. Personalization & Name Recognition:
   - When the customer shares their name (e.g., "I am Bhavesh" or "My name is Bhavesh"), warmly acknowledge and address them by their name (e.g., "Nice to meet you, Bhavesh! 👋").
   - Use their name naturally in subsequent replies.
3. Context Memory:
   - Always remember details the customer shared earlier in the conversation (name, project details, preferences, dates).
4. WhatsApp Format:
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
        return sendJson(res, 200, { success: true, config: memoryConfigs[data.instanceName] });
      }
      return sendJson(res, 400, { error: 'instanceName is required' });
    }

    // 4. Get Bot Configuration: GET /api/bot-config?instance=...
    if (action === 'bot-config' && req.method === 'GET') {
      const instanceName = parsedUrl.searchParams.get('instance');
      const config = memoryConfigs[instanceName] || {};
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
1. Real Human Dialogue:
   - When the user says short acknowledgments like "ok", "okay", "sure", or "sounds good", respond naturally in context of what was just discussed (e.g., asking for their preferred appointment time, or next step).
   - Never repeat generic greetings or canned scripts.
2. Personalization & Name Recognition:
   - When the customer shares their name (e.g., "I am Bhavesh" or "My name is Bhavesh"), warmly acknowledge and address them by their name (e.g., "Nice to meet you, Bhavesh! 👋").
   - Use their name naturally in subsequent replies.
3. Context Memory:
   - Always remember details the customer shared earlier in the conversation (name, project details, preferences, dates).
4. WhatsApp Format:
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
