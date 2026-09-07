const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8085;

app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── HTTP STATUS CODE REGISTRY ───
const HTTP_STATUS_MAP = {
  // 1xx Informational
  100: { title: "100 Continue", icon: "ℹ️", desc: "The server has received the request headers and the client should proceed." },
  101: { title: "101 Switching Protocols", icon: "🔄", desc: "The requester asked the server to switch protocols and the server agreed." },
  102: { title: "102 Processing", icon: "⚙️", desc: "The server has received and is processing the request, but no response is available yet." },
  103: { title: "103 Early Hints", icon: "💡", desc: "The server is returning headers to preload resources while final response prepares." },

  // 2xx Success
  200: { title: "200 OK", icon: "✅", desc: "The request has succeeded." },
  201: { title: "201 Created", icon: "✨", desc: "The request has been fulfilled and a new resource has been created." },
  202: { title: "202 Accepted", icon: "📥", desc: "The request has been accepted for processing, but processing is not finished." },
  203: { title: "203 Non-Authoritative Information", icon: "📋", desc: "The returned metadata was gathered from a local or third-party copy." },
  204: { title: "204 No Content", icon: "📭", desc: "The server successfully processed the request with no content returned." },
  205: { title: "205 Reset Content", icon: "🔄", desc: "The server successfully processed the request and requires the view to reset." },
  206: { title: "206 Partial Content", icon: "🧩", desc: "The server is delivering only part of the resource per Range header." },

  // 3xx Redirection
  300: { title: "300 Multiple Choices", icon: "🔀", desc: "The requested resource corresponds to multiple choices available." },
  301: { title: "301 Moved Permanently", icon: "📦", desc: "The requested resource has been assigned a new permanent URI." },
  302: { title: "302 Found", icon: "📍", desc: "The requested resource resides temporarily under a different URI." },
  303: { title: "303 See Other", icon: "👀", desc: "The response can be found under another URI using GET." },
  304: { title: "304 Not Modified", icon: "⚡", desc: "The cached resource has not been modified since the version specified." },
  305: { title: "305 Use Proxy", icon: "🛡️", desc: "The requested resource must be accessed through a designated proxy." },
  307: { title: "307 Temporary Redirect", icon: "↪️", desc: "The target resource resides temporarily under a different URI." },
  308: { title: "308 Permanent Redirect", icon: "🔁", desc: "The target resource has been permanently assigned to a new URI." },

  // 4xx Client Errors
  400: { title: "400 Bad Request", icon: "⚠️", desc: "The server cannot process the request due to invalid syntax or bad parameters." },
  401: { title: "401 Unauthorized", icon: "🔑", desc: "Authentication is required to access this resource." },
  402: { title: "402 Payment Required", icon: "💳", desc: "Reserved for digital payment protocols." },
  403: { title: "403 Forbidden", icon: "🔒", desc: "Access Denied. You do not have the required permissions to view this resource." },
  404: { title: "404 Not Found", icon: "🔍", desc: "URL Doesnt exist. Looking for something?" },
  405: { title: "405 Method Not Allowed", icon: "🚫", desc: "The request method is not supported for this resource." },
  406: { title: "406 Not Acceptable", icon: "❌", desc: "The server cannot produce a response matching requested Accept headers." },
  407: { title: "407 Proxy Authentication Required", icon: "🛂", desc: "The client must first authenticate itself with the proxy." },
  408: { title: "408 Request Timeout", icon: "⏱️", desc: "The server timed out waiting for the complete request from the client." },
  409: { title: "409 Conflict", icon: "⚔️", desc: "The request conflicts with the current state of the target resource." },
  410: { title: "410 Gone", icon: "🗑️", desc: "The target resource has been permanently deleted from origin." },
  411: { title: "411 Length Required", icon: "📏", desc: "The server refuses the request without a defined Content-Length header." },
  412: { title: "412 Precondition Failed", icon: "🛑", desc: "One or more conditions in the request headers evaluated to false." },
  413: { title: "413 Payload Too Large", icon: "📦", desc: "The request entity is larger than limits defined by the server." },
  414: { title: "414 URI Too Long", icon: "🔗", desc: "The URI provided was too long for the server to interpret." },
  415: { title: "415 Unsupported Media Type", icon: "📁", desc: "The payload format is in an unsupported media type." },
  416: { title: "416 Range Not Satisfiable", icon: "📐", desc: "The requested portion of the file cannot be supplied." },
  417: { title: "417 Expectation Failed", icon: "❓", desc: "The expectation given in the Expect request-header could not be met." },
  418: { title: "418 I'm a Teapot", icon: "🫖", desc: "The server refuses the attempt to brew coffee with a teapot." },
  421: { title: "421 Misdirected Request", icon: "🧭", desc: "The request was directed at a server that cannot produce a response." },
  422: { title: "422 Unprocessable Entity", icon: "📝", desc: "The request was well-formed but was unable to be followed due to semantic errors." },
  423: { title: "423 Locked", icon: "🔐", desc: "The resource that is being accessed is currently locked." },
  424: { title: "424 Failed Dependency", icon: "⛓️", desc: "The request failed because it depended on another request that failed." },
  425: { title: "425 Too Early", icon: "⚡", desc: "The server is unwilling to risk processing a request that might be replayed." },
  426: { title: "426 Upgrade Required", icon: "⬆️", desc: "The client should switch to a different protocol such as TLS/1.3." },
  428: { title: "428 Precondition Required", icon: "📋", desc: "The origin server requires the request to be conditional." },
  429: { title: "429 Too Many Requests", icon: "🚦", desc: "You have sent too many requests in a given amount of time (rate limited)." },
  431: { title: "431 Request Header Fields Too Large", icon: "📜", desc: "The server is unwilling to process the request because headers are too large." },
  451: { title: "451 Unavailable For Legal Reasons", icon: "⚖️", desc: "Access to this resource has been denied due to legal demands." },

  // 5xx Server Errors
  500: { title: "500 Internal Server Error", icon: "💥", desc: "The server encountered an unexpected error and was unable to complete your request." },
  501: { title: "501 Not Implemented", icon: "🛠️", desc: "The server does not support the functionality required to fulfill the request." },
  502: { title: "502 Bad Gateway", icon: "🌐", desc: "The server received an invalid response from the upstream origin server." },
  503: { title: "503 Service Unavailable", icon: "🚧", desc: "The server is temporarily unavailable due to maintenance or capacity limits." },
  504: { title: "504 Gateway Timeout", icon: "⏳", desc: "The upstream origin server failed to send a response in the time allowed." },
  505: { title: "505 HTTP Version Not Supported", icon: "📡", desc: "The server does not support the HTTP protocol version used in the request." },
  506: { title: "506 Variant Also Negotiates", icon: "🔄", desc: "Transparent content negotiation resulted in an internal circular reference." },
  507: { title: "507 Insufficient Storage", icon: "💾", desc: "The server is unable to store the representation needed to complete the request." },
  508: { title: "508 Loop Detected", icon: "🔁", desc: "The server detected an infinite loop while processing the request." },
  510: { title: "510 Not Extended", icon: "🔌", desc: "Further extensions to the request are required for the server to fulfill it." },
  511: { title: "511 Network Authentication Required", icon: "🛡️", desc: "The client needs to authenticate to gain network access." }
};

// ─── CRIMSONFLAME THEMED ERROR RENDERER ───
function renderErrorHTML(statusCode, customTitle, customDesc, customIcon) {
  const info = HTTP_STATUS_MAP[statusCode] || {
    title: `${statusCode}`,
    icon: "⚠️",
    desc: "An unexpected status response occurred."
  };

  const codeDisplay = statusCode || 404;
  const desc = customDesc || (statusCode === 404 ? "URL Doesnt exist. Looking for something?" : info.desc);
  const icon = customIcon || info.icon;
  const showIcon = statusCode !== 404 && icon;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${codeDisplay} | CrimsonFlame</title>
    <link rel="stylesheet" href="/style.css?v=9">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        .error-viewport {
            min-height: calc(100vh - 120px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 90px 20px 40px;
            position: relative;
            z-index: 10;
        }

        .error-card {
            background: rgba(20, 11, 16, 0.85);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(220, 38, 38, 0.35);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 35px rgba(220, 38, 38, 0.2);
            border-radius: 24px;
            max-width: 480px;
            width: 100%;
            padding: 46px 32px;
            text-align: center;
            position: relative;
        }

        .error-icon-indicator {
            font-size: 48px;
            line-height: 1;
            margin-bottom: 12px;
            display: ${showIcon ? 'block' : 'none'};
            animation: cfPulse 2s infinite ease-in-out;
        }

        .error-code-badge {
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: clamp(3.8rem, 12vw, 5.5rem);
            font-weight: 900;
            line-height: 1;
            margin-bottom: 12px;
            background: linear-gradient(135deg, #ff4d6d 0%, #dc2626 50%, #f97316 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 0 30px rgba(220, 38, 38, 0.4);
            letter-spacing: -2px;
        }

        .error-desc {
            color: rgba(255, 255, 255, 0.7);
            font-size: 1.05rem;
            line-height: 1.6;
            margin-bottom: 28px;
        }

        .error-actions {
            display: flex;
            justify-content: center;
        }

        .btn-back {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #dc2626;
            color: #fff;
            text-decoration: none;
            font-family: 'Outfit', sans-serif;
            font-weight: 700;
            font-size: 0.95rem;
            padding: 12px 36px;
            border-radius: 12px;
            transition: all 0.2s ease;
            box-shadow: 0 4px 18px rgba(220, 38, 38, 0.4);
        }

        .btn-back:hover {
            background: #ef4444;
            transform: translateY(-2px);
            box-shadow: 0 6px 24px rgba(220, 38, 38, 0.6);
            color: #fff;
        }

        @keyframes cfPulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.08); }
            100% { transform: scale(1); }
        }
    </style>
</head>
<body>
    <div class="bg-glow"></div>
    <div class="bg-glow-2"></div>
    <div class="particles" id="particles"></div>

    <nav class="pill-nav">
        <a href="/index.html" class="pill-brand">
            <img src="https://i.ibb.co/TBkJR2Jn/unnamed-removebg-preview.png" alt="CF" class="pill-brand-logo">
            <span class="pill-brand-text">CrimsonFlame</span>
        </a>
        <a href="/projects" class="pill-link">Projects</a>
        <a href="/crimx" class="pill-link">CrimX</a>
        <a href="https://discord.gg/tNK8z9gYGQ" class="pill-cta" target="_blank">
            <svg width="18" height="14" viewBox="0 0 24 18" fill="currentColor"><path d="M20.317 1.492a19.7 19.7 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.7 19.7 0 0 0 3.677 1.492a.07.07 0 0 0-.032.027C.533 6.093-.32 10.555.099 14.961a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03z"/></svg>
            <span>Discord</span>
        </a>
    </nav>

    <main class="error-viewport">
        <div class="error-card">
            ${showIcon ? `<div class="error-icon-indicator">${icon}</div>` : ''}
            <div class="error-code-badge">${codeDisplay}</div>
            <p class="error-desc">${desc}</p>
            <div class="error-actions">
                <a href="/index.html" class="btn-back">Back</a>
            </div>
        </div>
    </main>

    <footer class="site-footer">
        <p>© 2026 <strong>CrimsonFlame</strong>. All rights reserved.</p>
    </footer>

    <script>
        (function() {
            var c = document.getElementById('particles');
            if (!c) return;
            for (var i = 0; i < 25; i++) {
                var p = document.createElement('div');
                p.className = 'particle';
                var s = Math.random() * 3 + 1;
                p.style.width = s + 'px';
                p.style.height = s + 'px';
                p.style.left = Math.random() * 100 + '%';
                p.style.top = Math.random() * 100 + '%';
                p.style.animationDuration = (Math.random() * 12 + 8) + 's';
                p.style.animationDelay = (Math.random() * 8) + 's';
                p.style.opacity = Math.random() * 0.4 + 0.1;
                c.appendChild(p);
            }
        })();
    </script>
</body>
</html>`;
}

// ─── ADMIN KILL SWITCH & DOWNTIME STATE ───
let isServerStopped = false;
const ADMIN_SECRET = process.env.ADMIN_SECRET || "crimson-cf-2026";

// ─── API: CHECK SERVER STATE ───
app.get('/api/server/state', (req, res) => {
  res.json({
    online: !isServerStopped,
    status: isServerStopped ? "STOPPED" : "RUNNING",
    statusCode: isServerStopped ? 503 : 200,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// ─── API: SERVER CONTROL (STOP / START / CRASH) ───
app.all('/api/server/control', (req, res) => {
  const action = req.body?.action || req.query?.action;
  const secret = req.body?.secret || req.query?.secret || req.headers['x-admin-secret'];

  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized: Invalid secret key." });
  }

  if (action === 'stop') {
    isServerStopped = true;
    console.log('[CrimsonFlame Controller] Server set to STOPPED state (503 mode).');
    return res.json({ success: true, status: "STOPPED", message: "Server stopped. All public visitors will now receive HTTP 503." });
  }

  if (action === 'start' || action === 'resume') {
    isServerStopped = false;
    console.log('[CrimsonFlame Controller] Server resumed to RUNNING state.');
    return res.json({ success: true, status: "RUNNING", message: "Server resumed. Website is back online." });
  }

  if (action === 'crash') {
    console.error('[CrimsonFlame Controller] Hard crash command received.');
    res.json({ success: true, message: "Crashing server process now..." });
    setTimeout(() => { process.exit(1); }, 200);
    return;
  }

  res.status(400).json({ error: "Unknown action. Use 'stop', 'start', or 'crash'." });
});

// ─── CRIMX SECURITY ALERT & NOTIFICATION DISPATCHER ───
app.post('/api/notifications/security-alert', (req, res) => {
  const { type, email, uid, clientDetails, timestamp } = req.body || {};
  if (!email || !type) {
    return res.status(400).json({ success: false, error: "Missing required notification fields." });
  }

  const alertTitles = {
    new_sign_in: "🔐 New Sign-in Detected on Your CrimX Account",
    password_changed: "🔑 Your CrimX Password Has Been Changed"
  };

  const title = alertTitles[type] || "🛡️ CrimX Security Notification";
  const timeStr = new Date(timestamp || Date.now()).toUTCString();
  const device = clientDetails?.userAgent || "Web Browser";

  console.log(`[CrimX Security Alert] [${type}] Dispatched to ${email} (UID: ${uid || 'N/A'}) - Time: ${timeStr} - Device: ${device}`);

  // If SMTP environment variables exist in Cloud Run, transmit live email
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: smtpUser, pass: smtpPass }
      });

      const htmlBody = `
        <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: #0a0608; color: #ede8ea; padding: 32px; border-radius: 12px; max-width: 540px; margin: auto; border: 1px solid #331018;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #dc2626; margin: 0; font-size: 1.5rem;">CrimsonFlame</h2>
            <p style="color: #8a7f84; font-size: 0.85rem; margin-top: 4px;">CrimX Account Security Notice</p>
          </div>
          <div style="background: rgba(255,255,255,0.04); border-radius: 8px; padding: 20px; border: 1px solid rgba(255,255,255,0.08);">
            <h3 style="color: #fff; margin-top: 0;">${title}</h3>
            <p style="color: #ccc; font-size: 0.9rem; line-height: 1.5;">
              ${type === 'new_sign_in' 
                ? 'We detected a new sign-in session to your CrimX account.' 
                : 'Your CrimX account password was successfully changed.'}
            </p>
            <ul style="color: #8a7f84; font-size: 0.85rem; padding-left: 20px; line-height: 1.6;">
              <li><strong>Time:</strong> ${timeStr}</li>
              <li><strong>Device/Browser:</strong> ${device}</li>
            </ul>
            <p style="color: #f87171; font-size: 0.82rem; margin-bottom: 0;">
              If this was not you, please immediately visit <a href="https://crimx.crimsonflame.net" style="color: #f87171;">CrimX Dashboard</a> and secure your account.
            </p>
          </div>
        </div>
      `;

      transporter.sendMail({
        from: `"CrimX Security" <${process.env.SMTP_FROM || smtpUser}>`,
        to: email,
        subject: title,
        html: htmlBody
      }).then(info => {
        console.log(`[CrimX Security Alert] Live SMTP email transmitted: ${info.messageId}`);
      }).catch(err => {
        console.error(`[CrimX Security Alert] SMTP delivery error: ${err.message}`);
      });
    } catch(e) {
      console.warn(`[CrimX Security Alert] Nodemailer error: ${e.message}`);
    }
  }

  res.json({
    success: true,
    dispatched: true,
    type,
    email,
    title,
    message: `Security alert dispatched for ${email}`
  });
});

// ─── GLOBAL DOWNTIME INTERCEPTOR ───
app.use((req, res, next) => {
  // Allow control API, security notification API, and static styles/assets needed for the error page to render cleanly
  if (req.path.startsWith('/api/server') || req.path.startsWith('/api/notifications') || req.path === '/style.css' || req.path.startsWith('/assets/')) {
    return next();
  }

  if (isServerStopped) {
    return res.status(503).send(renderErrorHTML(
      503,
      "503 Service Unavailable",
      "The CrimsonFlame server has been stopped by the administrator for maintenance. Please check back shortly.",
      "🛑"
    ));
  }

  next();
});

// ─── 1. DYNAMIC TEST / TRIGGER ROUTES (Real HTTP Statuses) ───
app.get(['/status/:code', '/error/:code'], (req, res) => {
  const code = parseInt(req.params.code, 10);
  if (code && HTTP_STATUS_MAP[code]) {
    if (code === 404) {
      return res.status(404).sendFile(path.join(__dirname, '404.html'));
    }
    const info = HTTP_STATUS_MAP[code];
    return res.status(code).send(renderErrorHTML(code, info.title, info.desc, info.icon));
  }
  res.status(400).send(renderErrorHTML(400, "400 Invalid Status Code", "The requested status code is not recognized."));
});

// ─── 2. PROTECTED ROUTES (Returns REAL HTTP 403 Forbidden) ───
app.use(['/secret-folder', '/admin-private', '/private'], (req, res) => {
  const info = HTTP_STATUS_MAP[403];
  res.status(403).send(renderErrorHTML(403, info.title, info.desc, info.icon));
});

// ─── 3. SIMULATED 500 ERROR ROUTE FOR TESTING ───
app.get('/trigger-500', (req, res) => {
  throw new Error("Simulated Unhandled Server Exception");
});

// ─── 4. CRIMX SUBDOMAIN ROUTING & DASHBOARD ACCESS ISOLATION ───
// Dashboard is STRICTLY accessible via CrimX subdomain (crimx.crimsonflame.net).
// Any attempt to access crimsonflame.net/dashboard will redirect directly to https://crimx.crimsonflame.net/
app.use((req, res, next) => {
  const host = (req.headers.host || '').toLowerCase();
  const isCrimX = host.startsWith('crimx.') || host.startsWith('crimx-');
  const reqPath = req.path.toLowerCase();

  if (isCrimX) {
    if (reqPath === '/' || reqPath === '/dashboard' || reqPath === '/dashboard/' || reqPath === '/dashboard/index.html') {
      return res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
    }
    return next();
  }

  // Not on CrimX subdomain: block dashboard access on crimsonflame.net
  if (reqPath === '/dashboard' || reqPath === '/dashboard/' || reqPath.startsWith('/dashboard/')) {
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      const port = host.split(':')[1] ? `:${host.split(':')[1]}` : '';
      return res.redirect(302, `${req.protocol}://crimx.localhost${port}/`);
    }
    return res.redirect(301, 'https://crimx.crimsonflame.net/');
  }

  next();
});

// ─── 5. STATIC ASSET SERVING ───
app.use(express.static(__dirname, {
  extensions: ['html', 'htm'],
  index: false
}));

// ─── 6. DYNAMIC CLEAN URL ROUTING ───
app.get('/', (req, res) => {
  const host = (req.headers.host || '').toLowerCase();
  if (host.startsWith('crimx.') || host.startsWith('crimx-')) {
    return res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/crimx', (req, res) => {
  res.sendFile(path.join(__dirname, 'crimx', 'index.html'));
});

app.get('/projects', (req, res) => {
  res.sendFile(path.join(__dirname, 'projects', 'index.html'));
});

app.get('/developer', (req, res) => {
  res.sendFile(path.join(__dirname, 'developer', 'index.html'));
});

app.get('/support', (req, res) => {
  res.sendFile(path.join(__dirname, 'support', 'index.html'));
});

app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth', 'index.html'));
});

app.get('/link', (req, res) => {
  res.sendFile(path.join(__dirname, 'link', 'index.html'));
});

app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'reset-password.html'));
});

app.get(['/terms', '/tos'], (req, res) => {
  res.sendFile(path.join(__dirname, 'terms.md'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy.md'));
});

// ─── 6. REAL HTTP 404 NOT FOUND HANDLER ───
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// ─── 7. REAL HTTP 500 INTERNAL SERVER ERROR HANDLER ───
app.use((err, req, res, next) => {
  console.error('[CrimsonFlame Server Error]:', err);
  const info = HTTP_STATUS_MAP[500];
  res.status(500).send(renderErrorHTML(500, info.title, info.desc, info.icon));
});

app.listen(PORT, () => {
  console.log(`[CrimsonFlame Dynamic Server] Running live on port ${PORT}`);
  console.log(`- Status test route: http://localhost:${PORT}/status/403`);
  console.log(`- Protected route:   http://localhost:${PORT}/secret-folder`);
});
