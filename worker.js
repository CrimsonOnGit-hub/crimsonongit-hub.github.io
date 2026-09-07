// ─── CLOUDFLARE WORKER: UNIVERSAL HTTP STATUS & ERROR HANDLER ───
// Handles 1xx, 2xx, 3xx, 4xx, and 5xx status codes (EXCEPT 404, which is handled by GitHub Pages)

const HTTP_STATUS_MAP = {
  // ─── 1xx Informational ───
  100: { name: "Continue", icon: "ℹ️", message: "The server has received the initial request headers and the client should proceed." },
  101: { name: "Switching Protocols", icon: "🔄", message: "The server is switching protocols according to the Upgrade header." },
  102: { name: "Processing", icon: "⚙️", message: "The server has received and is processing the request, but no response is available yet." },
  103: { name: "Early Hints", icon: "💡", message: "The server is returning headers to preload critical page resources." },

  // ─── 2xx Success ───
  200: { name: "OK", icon: "✅", message: "The request has succeeded and the payload has been fetched." },
  201: { name: "Created", icon: "✨", message: "The request has been fulfilled and a new resource was created." },
  202: { name: "Accepted", icon: "📥", message: "The request has been accepted for processing, but processing has not completed." },
  203: { name: "Non-Authoritative Information", icon: "📋", message: "The returned metadata is from a third-party or local cache." },
  204: { name: "No Content", icon: "📭", message: "The request was successfully processed, but there is no content to return." },
  205: { name: "Reset Content", icon: "🔄", message: "The server requires the client to reset the document view." },
  206: { name: "Partial Content", icon: "🧩", message: "The server is delivering partial content per the Range header." },

  // ─── 3xx Redirection ───
  300: { name: "Multiple Choices", icon: "🔀", message: "The requested resource corresponds to any one of a set of representations." },
  301: { name: "Moved Permanently", icon: "📦", message: "This resource has permanently moved to a new destination URL." },
  302: { name: "Found", icon: "📍", message: "This resource is temporarily located at a different destination URL." },
  303: { name: "See Other", icon: "👀", message: "The response can be found under another URI using a GET request." },
  304: { name: "Not Modified", icon: "⚡", message: "The cached version of this resource is still fresh and valid." },
  305: { name: "Use Proxy", icon: "🛡️", message: "The requested resource must be accessed through a designated proxy." },
  307: { name: "Temporary Redirect", icon: "↪️", message: "The request should be repeated with another URI temporarily." },
  308: { name: "Permanent Redirect", icon: "🔁", message: "The request and all future requests should be directed to the given URI." },

  // ─── 4xx Client Errors (NOTE: 404 is intentionally omitted) ───
  400: { name: "Bad Request", icon: "⚠️", message: "The server could not understand the request due to malformed syntax or bad parameters." },
  401: { name: "Unauthorized", icon: "🔑", message: "Authentication is required to access this resource. Please log in." },
  402: { name: "Payment Required", icon: "💳", message: "Access to this resource requires payment confirmation." },
  403: { name: "Forbidden", icon: "🔒", message: "Access Denied. You do not have the required permissions to view this resource." },
  // 404: Handled directly by GitHub Pages (404.html)
  405: { name: "Method Not Allowed", icon: "🚫", message: "The HTTP request method is not supported for this requested endpoint." },
  406: { name: "Not Acceptable", icon: "❌", message: "The server cannot produce a response matching the client's Accept headers." },
  407: { name: "Proxy Authentication Required", icon: "🛂", message: "You must authenticate with a proxy server before proceeding." },
  408: { name: "Request Timeout", icon: "⏱️", message: "The server timed out waiting for the complete request from the client." },
  409: { name: "Conflict", icon: "⚔️", message: "The request could not be completed due to a conflict with the current state of the resource." },
  410: { name: "Gone", icon: "🗑️", message: "The requested resource is no longer available and will not be available again." },
  411: { name: "Length Required", icon: "📏", message: "The request did not specify the length of its content, which is required by the server." },
  412: { name: "Precondition Failed", icon: "🛑", message: "One or more conditions given in the request header fields evaluated to false." },
  413: { name: "Payload Too Large", icon: "📦", message: "The request entity is larger than limits defined by the server." },
  414: { name: "URI Too Long", icon: "🔗", message: "The URL requested was too long for the server to interpret." },
  415: { name: "Unsupported Media Type", icon: "📁", message: "The media format of the requested data is not supported by the server." },
  416: { name: "Range Not Satisfiable", icon: "📐", message: "The range specified in the request Range header cannot be fulfilled." },
  417: { name: "Expectation Failed", icon: "❓", message: "The server cannot meet the requirements of the Expect request-header field." },
  418: { name: "I'm a Teapot", icon: "🫖", message: "The server refuses the attempt to brew coffee with a teapot." },
  421: { name: "Misdirected Request", icon: "🧭", message: "The request was directed at a server that is not able to produce a response." },
  422: { name: "Unprocessable Entity", icon: "📝", message: "The request was well-formed but was unable to be followed due to semantic errors." },
  423: { name: "Locked", icon: "🔐", message: "The resource that is being accessed is currently locked." },
  424: { name: "Failed Dependency", icon: "⛓️", message: "The request failed due to failure of a previous request." },
  425: { name: "Too Early", icon: "⚡", message: "The server is unwilling to risk processing a request that might be replayed." },
  426: { name: "Upgrade Required", icon: "⬆️", message: "The client should switch to a different protocol such as TLS/1.3." },
  428: { name: "Precondition Required", icon: "📋", message: "The origin server requires the request to be conditional to prevent conflicts." },
  429: { name: "Too Many Requests", icon: "🚦", message: "You have sent too many requests in a short period. Please slow down and try again later." },
  431: { name: "Request Header Fields Too Large", icon: "📜", message: "The server is unwilling to process the request because header fields are too large." },
  451: { name: "Unavailable For Legal Reasons", icon: "⚖️", message: "Access to this resource has been blocked due to legal demands." },

  // ─── 5xx Server Errors ───
  500: { name: "Internal Server Error", icon: "💥", message: "The server encountered an unexpected error and was unable to complete your request." },
  501: { name: "Not Implemented", icon: "🛠️", message: "The server does not support the functionality required to fulfill the request." },
  502: { name: "Bad Gateway", icon: "🌐", message: "The server received an invalid response from the upstream origin server." },
  503: { name: "Service Unavailable", icon: "🚧", message: "The server is temporarily unavailable due to maintenance or high load." },
  504: { name: "Gateway Timeout", icon: "⏳", message: "The upstream origin server failed to send a response in the time allowed." },
  505: { name: "HTTP Version Not Supported", icon: "📡", message: "The server does not support the HTTP protocol version used in the request." },
  506: { name: "Variant Also Negotiates", icon: "🔄", message: "Transparent content negotiation resulted in an internal circular reference." },
  507: { name: "Insufficient Storage", icon: "💾", message: "The server is unable to store the representation needed to complete the request." },
  508: { name: "Loop Detected", icon: "🔁", message: "The server detected an infinite loop while processing a request." },
  511: { name: "Network Authentication Required", icon: "🛡️", message: "You need to authenticate to gain network access." }
};

function renderStatusPage(statusCode, customMessage) {
  const info = HTTP_STATUS_MAP[statusCode] || {
    name: "HTTP Status",
    icon: "⚠️",
    message: customMessage || "An unexpected HTTP status code was encountered."
  };

  const codeDisplay = statusCode || 404;
  const desc = customMessage || (statusCode === 404 ? "URL Doesnt exist. Looking for something?" : (info.message || info.name));
  const showIcon = statusCode !== 404 && info.icon;

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
            ${showIcon ? `<div class="error-icon-indicator">${info.icon}</div>` : ''}
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

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // ─── 1. DIRECT STATUS TEST ROUTE ───
    // Allows testing any status code: e.g., /_status/403 or ?status=500
    const testMatch = url.pathname.match(/^\/_status\/(\d{3})$/);
    const queryStatus = url.searchParams.get('status');
    const requestedCode = testMatch ? parseInt(testMatch[1], 10) : (queryStatus ? parseInt(queryStatus, 10) : null);

    if (requestedCode && requestedCode !== 404 && HTTP_STATUS_MAP[requestedCode]) {
      return new Response(renderStatusPage(requestedCode), {
        status: requestedCode,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          'Cache-Control': 'no-store'
        }
      });
    }

    // ─── 2. PROTECTED FOLDERS (403 FORBIDDEN) ───
    if (url.pathname.startsWith('/secret-folder/') || url.pathname.startsWith('/private/')) {
      return new Response(renderStatusPage(403), {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      });
    }

    // ─── 3. FETCH FROM ORIGIN (GITHUB PAGES) ───
    let response;
    try {
      response = await fetch(request);
    } catch (err) {
      // Upstream connection failure -> 502 Bad Gateway
      return new Response(renderStatusPage(502, "Unable to reach the upstream origin server. Please try again in a few moments."), {
        status: 502,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      });
    }

    // ─── 4. 404 PASS-THROUGH ───
    // IMPORTANT: 404 is specifically excluded so GitHub Pages serves 404.html normally
    if (response.status === 404) {
      return response;
    }

    // ─── 5. INTERCEPT ANY OTHER 4xx / 5xx ORIGIN ERRORS ───
    if (response.status >= 400 && HTTP_STATUS_MAP[response.status]) {
      return new Response(renderStatusPage(response.status), {
        status: response.status,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8'
        }
      });
    }

    // Normal response (2xx, 3xx, or unmapped)
    return response;
  }
};
