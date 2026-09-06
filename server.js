const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── HTTP STATUS CODE REGISTRY ───
const HTTP_STATUS_MAP = {
  // 1xx Informational
  100: { title: "100 Continue", icon: "ℹ️", desc: "The server has received the request headers and the client should proceed with the request." },
  101: { title: "101 Switching Protocols", icon: "🔄", desc: "The requester has asked the server to switch protocols and the server agreed to do so." },
  102: { title: "102 Processing", icon: "⚙️", desc: "The server has received and is processing the request, but no response is available yet." },
  103: { title: "103 Early Hints", icon: "💡", desc: "The server is returning headers to preload resources while the final response is prepared." },

  // 2xx Success
  200: { title: "200 OK", icon: "✅", desc: "The request has succeeded." },
  201: { title: "201 Created", icon: "✨", desc: "The request has been fulfilled and a new resource has been created." },
  202: { title: "202 Accepted", icon: "📥", desc: "The request has been accepted for processing, but processing has not completed." },
  203: { title: "203 Non-Authoritative Information", icon: "📋", desc: "The returned metadata was gathered from a local or third-party copy." },
  204: { title: "204 No Content", icon: "📭", desc: "The server successfully processed the request and is not returning any content." },
  205: { title: "205 Reset Content", icon: "🔄", desc: "The server successfully processed the request and requires the view to be reset." },
  206: { title: "206 Partial Content", icon: "🧩", desc: "The server is delivering only part of the resource due to a Range header." },

  // 3xx Redirection
  300: { title: "300 Multiple Choices", icon: "🔀", desc: "The requested resource corresponds to multiple choices available." },
  301: { title: "301 Moved Permanently", icon: "📦", desc: "The requested resource has been assigned a new permanent URI." },
  302: { title: "302 Found", icon: "📍", desc: "The requested resource resides temporarily under a different URI." },
  303: { title: "303 See Other", icon: "👀", desc: "The response to the request can be found under another URI using GET." },
  304: { title: "304 Not Modified", icon: "⚡", desc: "The resource has not been modified since the version specified in request." },
  305: { title: "305 Use Proxy", icon: "🛡️", desc: "The requested resource must be accessed through a designated proxy." },
  307: { title: "307 Temporary Redirect", icon: "↪️", desc: "The target resource resides temporarily under a different URI." },
  308: { title: "308 Permanent Redirect", icon: "🔁", desc: "The target resource has been permanently assigned to a new URI." },

  // 4xx Client Errors
  400: { title: "400 Bad Request", icon: "⚠️", desc: "The server cannot process the request due to invalid syntax or bad parameters." },
  401: { title: "401 Unauthorized", icon: "🔑", desc: "Authentication is required to access this resource." },
  402: { title: "402 Payment Required", icon: "💳", desc: "Reserved for digital payment protocols." },
  403: { title: "403 Forbidden", icon: "🔒", desc: "Access Denied. You do not have the required permissions to view this resource." },
  404: { title: "404 Not Found", icon: "🔍", desc: "URL Doesnt exist. Looking for something?" },
  405: { title: "405 Method Not Allowed", icon: "🚫", desc: "The request method is known by the server but not supported for this resource." },
  406: { title: "406 Not Acceptable", icon: "❌", desc: "The server cannot produce a response matching the Accept headers requested." },
  407: { title: "407 Proxy Authentication Required", icon: "🛂", desc: "The client must first authenticate itself with the proxy." },
  408: { title: "408 Request Timeout", icon: "⏱️", desc: "The server timed out waiting for the complete request from the client." },
  409: { title: "409 Conflict", icon: "⚔️", desc: "The request conflicts with the current state of the target resource." },
  410: { title: "410 Gone", icon: "🗑️", desc: "The target resource has been permanently deleted from origin." },
  411: { title: "411 Length Required", icon: "📏", desc: "The server refuses the request without a defined Content-Length header." },
  412: { title: "412 Precondition Failed", icon: "🛑", desc: "One or more conditions given in the request header fields evaluated to false." },
  413: { title: "413 Payload Too Large", icon: "📦", desc: "The request entity is larger than limits defined by the server." },
  414: { title: "414 URI Too Long", icon: "🔗", desc: "The URI provided was too long for the server to interpret." },
  415: { title: "415 Unsupported Media Type", icon: "📁", desc: "The payload format is in an unsupported media type." },
  416: { title: "416 Range Not Satisfiable", icon: "📐", desc: "The client asked for a portion of the file that cannot be supplied." },
  417: { title: "417 Expectation Failed", icon: "❓", desc: "The expectation given in the Expect request-header field could not be met." },
  418: { title: "418 I'm a Teapot", icon: "🫖", desc: "The server refuses the attempt to brew coffee with a teapot." },
  421: { title: "421 Misdirected Request", icon: "🧭", desc: "The request was directed at a server that is not able to produce a response." },
  422: { title: "422 Unprocessable Entity", icon: "📝", desc: "The request was well-formed but could not be followed due to semantic errors." },
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

function renderErrorHTML(statusCode, customTitle, customDesc, customIcon) {
  const info = HTTP_STATUS_MAP[statusCode] || {
    title: `${statusCode} HTTP Status`,
    icon: "⚠️",
    desc: "An unexpected status response occurred."
  };

  const title = customTitle || info.title;
  const desc = customDesc || info.desc;
  const icon = customIcon || info.icon;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | CrimsonFlame</title>
    <link rel="stylesheet" href="/style.css">
    <style>
        body {
            background-color: #0d1117;
            color: #c9d1d9;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 16px;
            box-sizing: border-box;
        }
        .container {
            text-align: center;
            padding: 42px 32px;
            border: 1px solid rgba(220, 38, 38, 0.35);
            border-radius: 16px;
            background-color: #161b22;
            box-shadow: 0 16px 40px rgba(0,0,0,0.7), 0 0 30px rgba(220, 38, 38, 0.2);
            max-width: 460px;
            width: 100%;
            box-sizing: border-box;
        }
        .icon {
            font-size: 58px;
            margin-bottom: 18px;
            line-height: 1;
            display: inline-block;
            animation: pulse 2s infinite ease-in-out;
        }
        h1 {
            font-size: 28px;
            margin: 0 0 12px 0;
            color: #ff7b72;
            font-weight: 800;
            letter-spacing: -0.02em;
        }
        p {
            font-size: 15px;
            color: #8b949e;
            line-height: 1.6;
            margin: 0 0 28px 0;
        }
        .btn {
            display: inline-block;
            background-color: #dc2626;
            color: #ffffff;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 14px;
            transition: all 0.2s ease;
            box-shadow: 0 4px 16px rgba(220, 38, 38, 0.4);
        }
        .btn:hover {
            background-color: #ef4444;
            transform: translateY(-2px);
            box-shadow: 0 6px 22px rgba(220, 38, 38, 0.6);
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.08); }
            100% { transform: scale(1); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">${icon}</div>
        <h1>${title}</h1>
        <p>${desc}</p>
        <a href="/" class="btn">Return Home</a>
    </div>
</body>
</html>`;
}

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

// ─── 4. STATIC ASSET SERVING ───
app.use(express.static(__dirname, {
  extensions: ['html', 'htm'],
  index: false
}));

// ─── 5. DYNAMIC CLEAN URL ROUTING ───
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/projects', (req, res) => {
  res.sendFile(path.join(__dirname, 'projects', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
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
