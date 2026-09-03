import https from 'https';
import http from 'http';
import { URL, URLSearchParams } from 'url';

// In-memory config cache for serverless runtime
const memoryConfigs = {};

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

// Built-in Smart FAQ Engine Fallback (Humanized & Warm)
function generateSmartReply(userMessage, businessName, faqs) {
  const msg = (userMessage || '').toLowerCase().trim();
  const bName = businessName || 'our team';
  const faqText = faqs || '';

  // 1. Greetings
  if (/^(hi|hello|hey|hola|namaste|good\s*(morning|afternoon|evening)|start|help|test)/i.test(msg)) {
    return `👋 Hello! Thanks for reaching out to *${bName}*. I'm happy to assist you!\n\nHow can I help you today? You can ask me about:\n• 💰 *Services & Pricing*\n• 🕒 *Working Hours*\n• 📍 *Our Location*\n• 📅 *Booking an Appointment*`;
  }

  // 2. Pricing / Cost / Rates / Catalog / Photos
  if (/(price|pricing|cost|how\s*much|rate|charges|fee|catalog|catalogue|brochure|portfolio|photo|pic|video)/i.test(msg)) {
    const lines = faqText.split('\n').filter(l => /(price|pricing|cost|\$|₹|fee|clean|whiten|consult|service|rate|package)/i.test(l));
    if (lines.length > 0) {
      return `💰 *Here are the pricing & services for ${bName}:*\n\n${lines.join('\n')}\n\nWould you like me to help you book a slot or answer any specific questions? 😊`;
    }
    return `💰 Here is our general service pricing at *${bName}*:\n• Consultation & Assessment: $50\n• Complete Package: $150 - $400\n\nLet me know if you would like more details on any service!`;
  }

  // 3. Hours / Timing / When open
  if (/(hour|timing|time|open|close|when\s*are\s*you|sunday|monday|saturday|weekend)/i.test(msg)) {
    const lines = faqText.split('\n').filter(l => /(hour|timing|open|close|mon|tue|wed|thu|fri|sat|sun|am|pm)/i.test(l));
    if (lines.length > 0) {
      return `🕒 *Business Hours for ${bName}:*\n\n${lines.join('\n')}\n\nFeel free to drop by or schedule an appointment during these times!`;
    }
    return `🕒 We are open Monday to Saturday from 9:00 AM to 6:00 PM (Closed on Sundays).`;
  }

  // 4. Booking / Appointment / Schedule
  if (/(book|appointment|schedule|slot|reserve|visit)/i.test(msg)) {
    const lines = faqText.split('\n').filter(l => /(book|cal\.com|calendly|link|appointment|visit)/i.test(l));
    if (lines.length > 0) {
      return `📅 *Booking an Appointment with ${bName}:*\n\n${lines.join('\n')}\n\nAlternatively, reply with your preferred date and time, and our team will confirm it for you!`;
    }
    return `📅 We would love to schedule you in! Please reply with your preferred date & time, and our team will book your slot right away.`;
  }

  // 5. Location / Address / Where
  if (/(location|address|where|direction|city|map)/i.test(msg)) {
    const lines = faqText.split('\n').filter(l => /(location|address|street|suite|road|floor|map)/i.test(l));
    if (lines.length > 0) {
      return `📍 *Our Location:*\n\n${lines.join('\n')}\n\nLet us know if you need assistance with directions!`;
    }
    return `📍 We are located at Main Office Suite 400. Let us know if you need driving directions!`;
  }

  // 6. Contact / Phone / Emergency / Human
  if (/(contact|phone|call|number|human|agent|talk|emergency|person)/i.test(msg)) {
    const lines = faqText.split('\n').filter(l => /(contact|call|emergency|phone|\d{3})/i.test(l));
    if (lines.length > 0) {
      return `📞 *Contact Information:*\n\n${lines.join('\n')}\n\nA representative is also notified and can reply to this chat shortly!`;
    }
    return `📞 You can reach our team directly. A team member has also been notified and will jump into this chat shortly!`;
  }

  // 7. Keyword Search in Custom FAQ
  const words = msg.split(/\s+/).filter(w => w.length > 3);
  for (const word of words) {
    const matchedLines = faqText.split('\n').filter(l => l.toLowerCase().includes(word));
    if (matchedLines.length > 0) {
      return `ℹ️ *Information about ${bName}:*\n\n${matchedLines.slice(0, 4).join('\n')}\n\nLet me know if you need anything else!`;
    }
  }

  // 8. General Human Fallback
  return `Thank you for messaging *${bName}*! 😊\n\nI've received your inquiry. You can ask me about our *pricing*, *services*, *hours*, *location*, or *booking an appointment*. A team member will also follow up with you shortly!`;
}

// Google Gemini Flash AI Engine (Humanized & Natural)
function callGemini(apiKey, systemPrompt, userMessage, businessName, faqs) {
  return new Promise((resolve) => {
    const key = apiKey || process.env.GEMINI_API_KEY;

    if (!key) {
      return resolve(generateSmartReply(userMessage, businessName, faqs));
    }

    const payload = JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 280,
        temperature: 0.65,
        topP: 0.95
      }
    });

    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`,
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
            resolve(generateSmartReply(userMessage, businessName, faqs));
          }
        } catch (e) {
          resolve(generateSmartReply(userMessage, businessName, faqs));
        }
      });
    });

    req.on('error', () => resolve(generateSmartReply(userMessage, businessName, faqs)));
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
            console.log(`[WhatsApp Incoming] [${instanceName}] from ${remoteJid}: "${userText}"`);

            const botConfig = memoryConfigs[instanceName] || {};
            const businessName = botConfig.businessName || instanceName.replace(/_/g, ' ') || 'Our Business';

            // High-EQ, Human-Like System Prompt for Gemini
            const systemPrompt = `You are a warm, courteous, and highly competent customer support concierge for "${businessName}".
Your goal is to assist clients naturally on WhatsApp, answering questions clearly and building rapport.

BUSINESS DETAILS, PRICING & FAQS:
${botConfig.faqs || 'We are a dedicated professional business providing quality services. Help the customer with whatever they need.'}

CONVERSATION GUIDELINES:
1. Tone: Friendly, polite, professional, and conversational (use a warm greeting and 1-2 natural emojis like 👋, 😊, 🕒).
2. WhatsApp Format: Keep replies concise (2-4 sentences). Use bullet points (•) for lists and *bold* for key terms like prices or dates.
3. Accuracy: Base answers strictly on the business details provided above. If an inquiry is not covered, politely state that you've noted it and a team member will assist them shortly.
4. Action-Oriented: If the user wants to book or buy, direct them to the booking link or phone number provided in the FAQs.`;

            // Call Google Gemini Flash AI (with built-in Smart FAQ fallback)
            const aiReply = await callGemini(
              botConfig.geminiKey, 
              systemPrompt, 
              userText, 
              businessName, 
              botConfig.faqs
            );

            console.log(`[AI Response] [${instanceName}] replying: "${aiReply}"`);

            const phoneSender = remoteJid.split('@')[0].replace(/[^0-9]/g, '');
            const evoServer = botConfig.serverUrl || process.env.EVOLUTION_SERVER || 'https://evolution-api-2gki.srv1722699.hstgr.cloud';
            const evoKey = req.headers['apikey'] || botConfig.serverKey || process.env.EVOLUTION_KEY || '429683C4C977415CAAFCCE10F7D57E11';

            // Media attachment detection (Catalog, Photos, Videos, Map)
            const lowerMsg = userText.toLowerCase();
            let mediaToSend = null;

            if (/(price|pricing|catalog|catalogue|brochure|portfolio|photo|picture|sample|menu)/i.test(lowerMsg) && botConfig.catalogMediaUrl) {
              mediaToSend = botConfig.catalogMediaUrl;
            } else if (/(location|address|map|where|store|office)/i.test(lowerMsg) && botConfig.locationMediaUrl) {
              mediaToSend = botConfig.locationMediaUrl;
            } else if (/(hi|hello|hey|welcome|start)/i.test(lowerMsg) && botConfig.welcomeMediaUrl) {
              mediaToSend = botConfig.welcomeMediaUrl;
            }

            if (mediaToSend) {
              const { mediatype, mimetype } = getMediaTypeAndMime(mediaToSend);
              console.log(`[Sending Media] ${mediatype} from ${mediaToSend}`);
              
              await forwardToEvolution(evoServer, evoKey, 'POST', `/message/sendMedia/${encodeURIComponent(instanceName)}`, {
                number: phoneSender,
                mediatype,
                mimetype,
                caption: aiReply,
                media: mediaToSend,
                fileName: `attachment.${mediatype === 'document' ? 'pdf' : (mediatype === 'video' ? 'mp4' : 'jpg')}`
              });
            } else {
              // Standard Text Message
              await forwardToEvolution(evoServer, evoKey, 'POST', `/message/sendText/${encodeURIComponent(instanceName)}`, {
                number: phoneSender,
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

    // 5. Test Chat: POST /api/test-chat
    if (action === 'test-chat' && req.method === 'POST') {
      const data = await getBody(req);
      const businessName = data.businessName || 'Our Business';
      const systemPrompt = `You are a warm, courteous, and highly competent customer support concierge for "${businessName}". Answer the customer in a friendly, conversational WhatsApp format (2-3 sentences).
BUSINESS INFORMATION & FAQS:
${data.faqs || 'We provide professional services.'}`;

      const reply = await callGemini(
        data.geminiKey, 
        systemPrompt, 
        data.message || 'Hi', 
        businessName, 
        data.faqs
      );
      return sendJson(res, 200, { reply });
    }

    return sendJson(res, 200, { status: 'BotFlow Gemini AI + Media Engine Live' });

  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
