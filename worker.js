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
  510: { name: "Not Extended", icon: "🔌", message: "Further extensions to the request are required for the server to fulfill it." },
  511: { name: "Network Authentication Required", icon: "🛡️", message: "You need to authenticate to gain network access." }
};

function renderStatusPage(statusCode, customMessage) {
  const info = HTTP_STATUS_MAP[statusCode] || {
    name: "HTTP Status",
    icon: "⚠️",
    message: customMessage || "An unexpected HTTP status code was encountered."
  };

  const name = info.name;
  const icon = info.icon;
  const message = customMessage || info.message;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${statusCode} - ${name} | CrimsonFlame</title>
    <style>
        body {
            background-color: #0d1117;
            color: #c9d1d9;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            padding: 16px;
            box-sizing: border-box;
        }
        .container {
            text-align: center;
            padding: 40px 32px;
            border: 1px solid #30363d;
            border-radius: 14px;
            background-color: #161b22;
            box-shadow: 0 12px 32px rgba(0,0,0,0.6);
            max-width: 460px;
            width: 100%;
            box-sizing: border-box;
        }
        .icon {
            font-size: 64px;
            margin-bottom: 20px;
            line-height: 1;
            animation: pulse 2s infinite ease-in-out;
            display: inline-block;
        }
        h1 {
            font-size: 26px;
            margin: 0 0 12px 0;
            color: #ff7b72;
            font-weight: 700;
            letter-spacing: -0.02em;
        }
        p {
            font-size: 15px;
            color: #8b949e;
            line-height: 1.6;
            margin: 0 0 26px 0;
        }
        .btn {
            display: inline-block;
            background-color: #21262d;
            color: #c9d1d9;
            text-decoration: none;
            padding: 11px 24px;
            border: 1px solid rgba(240, 246, 252, 0.12);
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.2s ease;
        }
        .btn:hover {
            background-color: #30363d;
            border-color: #8b949e;
            color: #fff;
            transform: translateY(-1px);
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
        <h1>${statusCode} ${name}</h1>
        <p>${message}</p>
        <a href="/" class="btn">Return Home</a>
    </div>
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
