const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = 3000;
const EVOLUTION_API_BASE = 'http://localhost:8085';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';

const CONFIG_FILE = path.join(__dirname, 'bot_configs.json');

function loadConfigs() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveConfig(instanceName, data) {
  const configs = loadConfigs();
  configs[instanceName] = { ...(configs[instanceName] || {}), ...data };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
  return configs[instanceName];
}

// Built-in Smart FAQ Matcher (Works 100% Free Without Any OpenAI Key)
function generateSmartReply(userMessage, businessName, faqs) {
  const msg = (userMessage || '').toLowerCase().trim();
  const bName = businessName || 'our business';
  const faqText = faqs || '';

  // 1. Greetings
  if (/^(hi|hello|hey|hola|namaste|good\s*(morning|afternoon|evening)|start|help)/i.test(msg)) {
    return `👋 Hello! Welcome to ${bName}.\n\nHow can we help you today? You can ask about:\n• 🕒 Business Hours\n• 💰 Services & Pricing\n• 📍 Location / Address\n• 📅 Booking an Appointment`;
  }

  // 2. Pricing / Cost / Rates
  if (/(price|pricing|cost|how\s*much|rate|charges|fee)/i.test(msg)) {
    const lines = faqText.split('\n').filter(l => /(price|pricing|cost|\$|₹|fee|clean|whiten|consult|service)/i.test(l));
    if (lines.length > 0) {
      return `💰 *${bName} - Pricing & Services:*\n\n${lines.join('\n')}\n\nWould you like to book an appointment?`;
    }
    return `💰 Here are our standard service rates at ${bName}:\n• Routine Consultation: $30\n• Service Package: $60 - $150\n\nLet us know which service you need!`;
  }

  // 3. Hours / Timing / When open
  if (/(hour|timing|time|open|close|when\s*are\s*you|sunday|monday|saturday)/i.test(msg)) {
    const lines = faqText.split('\n').filter(l => /(hour|timing|open|close|mon|tue|wed|thu|fri|sat|sun|am|pm)/i.test(l));
    if (lines.length > 0) {
      return `🕒 *Business Hours for ${bName}:*\n\n${lines.join('\n')}`;
    }
    return `🕒 We are open Monday to Saturday from 9:00 AM to 6:00 PM (Closed on Sundays).`;
  }

  // 4. Booking / Appointment / Schedule
  if (/(book|appointment|schedule|slot|reserve|visit)/i.test(msg)) {
    const lines = faqText.split('\n').filter(l => /(book|cal\.com|calendly|link|appointment|visit)/i.test(l));
    if (lines.length > 0) {
      return `📅 *Book an Appointment with ${bName}:*\n\n${lines.join('\n')}`;
    }
    return `📅 You can book an appointment with ${bName} anytime! Please reply with your preferred date & time, or visit our booking link.`;
  }

  // 5. Location / Address / Where
  if (/(location|address|where|direction|city|map)/i.test(msg)) {
    const lines = faqText.split('\n').filter(l => /(location|address|street|suite|road|floor|map)/i.test(l));
    if (lines.length > 0) {
      return `📍 *Our Location:*\n\n${lines.join('\n')}`;
    }
    return `📍 We are located at 124 Main Street, Suite 400. Let us know if you need directions!`;
  }

  // 6. Contact / Phone / Emergency / Human
  if (/(contact|phone|call|number|human|agent|talk|emergency)/i.test(msg)) {
    const lines = faqText.split('\n').filter(l => /(contact|call|emergency|phone|\d{3})/i.test(l));
    if (lines.length > 0) {
      return `📞 *Contact Info:*\n\n${lines.join('\n')}`;
    }
    return `📞 You can reach our support team directly at (555) 019-2834. A staff member will also reply to this chat shortly!`;
  }

  // 7. Keyword Search in Custom FAQ
  const words = msg.split(/\s+/).filter(w => w.length > 3);
  for (const word of words) {
    const matchedLines = faqText.split('\n').filter(l => l.toLowerCase().includes(word));
    if (matchedLines.length > 0) {
      return `ℹ️ *${bName} Information:*\n\n${matchedLines.slice(0, 4).join('\n')}`;
    }
  }

  // 8. Polite General Fallback
  return `Thank you for contacting ${bName}! 😊\n\nWe received your message. You can ask me about our *pricing*, *business hours*, *location*, or *booking an appointment*. A team member will also follow up with you shortly!`;
}

// Helper to send WhatsApp text via Evolution API
function sendWhatsAppMessage(instanceName, number, text) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      number: number.replace(/[^0-9]/g, ''),
      text: text,
      delay: 1200
    });

    const req = http.request({
      hostname: 'localhost',
      port: 8085,
      path: `/message/sendText/${encodeURIComponent(instanceName)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'apikey': EVOLUTION_API_KEY
      }
    }, res => {
      let resp = '';
      res.on('data', c => resp += c);
      res.on('end', () => resolve({ status: res.statusCode, data: resp }));
    });

    req.on('error', err => resolve({ error: err.message }));
    req.write(payload);
    req.end();
  });
}

// Helper to call OpenAI API with fallback
function callOpenAI(apiKey, systemPrompt, userMessage, businessName, faqs) {
  return new Promise((resolve) => {
    if (!apiKey) {
      // Use built-in smart FAQ engine when no key is provided
      return resolve(generateSmartReply(userMessage, businessName, faqs));
    }

    const payload = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt || 'You are a helpful customer support assistant.' },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 250,
      temperature: 0.7
    });

    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0]?.message?.content) {
            resolve(json.choices[0].message.content.trim());
          } else {
            // Fallback to Smart FAQ engine if OpenAI fails
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

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // 1. Webhook endpoint from Evolution API: /webhook/ai-agent/:instanceName
  if (pathname.startsWith('/webhook/ai-agent/') && req.method === 'POST') {
    const instanceName = decodeURIComponent(pathname.replace('/webhook/ai-agent/', ''));
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const eventData = JSON.parse(body);
        
        if (eventData.event === 'messages.upsert' && eventData.data) {
          const msg = eventData.data;
          const isFromMe = msg.key?.fromMe;
          const remoteJid = msg.key?.remoteJid || '';
          
          if (!isFromMe && !remoteJid.includes('@broadcast') && !remoteJid.includes('status@broadcast')) {
            const userText = msg.message?.conversation || 
                             msg.message?.extendedTextMessage?.text || 
                             msg.message?.imageMessage?.caption || '';

            if (userText && userText.trim().length > 0) {
              console.log(`[WhatsApp Incoming] [${instanceName}] from ${remoteJid}: "${userText}"`);

              const configs = loadConfigs();
              const botConfig = configs[instanceName] || {};

              if (botConfig.enabled !== false) {
                const systemPrompt = `You are a friendly, concise 24/7 AI assistant for ${botConfig.businessName || 'our business'}.\n\n` +
                                     `BUSINESS INFORMATION & FAQS:\n${botConfig.faqs || 'We are a professional service provider. Answer questions politely.'}\n\n` +
                                     `RULES:\n- Keep answers concise and helpful (under 2-3 sentences).\n` +
                                     `- If you do not know the answer, politely ask them to leave their query for human staff.`;

                const aiReply = await callOpenAI(
                  botConfig.openaiKey, 
                  systemPrompt, 
                  userText, 
                  botConfig.businessName, 
                  botConfig.faqs
                );
                
                console.log(`[AI Response] [${instanceName}] replying: "${aiReply}"`);

                const phoneSender = remoteJid.split('@')[0];
                await sendWhatsAppMessage(instanceName, phoneSender, aiReply);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error processing webhook message:', err);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'received' }));
    });
    return;
  }

  // 2. Save Bot Configuration API: POST /api/bot-config
  if (pathname === '/api/bot-config' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data.instanceName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'instanceName is required' }));
        }
        const saved = saveConfig(data.instanceName, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, config: saved }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 3. Get Bot Configuration API: GET /api/bot-config?instance=...
  if (pathname === '/api/bot-config' && req.method === 'GET') {
    const instanceName = parsedUrl.searchParams.get('instance');
    const configs = loadConfigs();
    const config = configs[instanceName] || {};
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(config));
  }

  // 4. Test Chat API: POST /api/test-chat
  if (pathname === '/api/test-chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const reply = await callOpenAI(
          data.openaiKey, 
          null, 
          data.message || 'Hi', 
          data.businessName, 
          data.faqs
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 5. Static File Server (connect.html)
  const filePath = path.join(__dirname, pathname === '/' ? 'connect.html' : pathname.replace(/^\//, ''));
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`🚀 BotFlow Master Engine running at http://localhost:${PORT}`);
});
