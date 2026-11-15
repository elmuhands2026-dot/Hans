/**
 * Cloudflare Worker - CORS-safe proxy for Hans Login Apps Script API.
 *
 * Required Worker environment variables:
 *   GAS_URL          = deployed Apps Script Web App URL ending in /exec
 *   GAS_SHARED_SECRET = same random secret stored in Apps Script Script Properties as WORKER_SECRET
 *   ALLOWED_ORIGIN   = https://YOUR-GITHUB-USERNAME.github.io
 *
 * Deploy this file as a Cloudflare Worker.
 */

const ALLOWED_ACTIONS = new Set(["login", "validateSession", "logout"]);

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN;

    if (request.method === "OPTIONS") {
      if (!isAllowedOrigin(origin, allowedOrigin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (!isAllowedOrigin(origin, allowedOrigin)) {
      return jsonResponse({ ok: false, message: "Origin not allowed." }, 403, origin, allowedOrigin);
    }

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, message: "Method not allowed." }, 405, origin, allowedOrigin);
    }

    if (!env.GAS_URL || !env.GAS_SHARED_SECRET || !allowedOrigin) {
      return jsonResponse({ ok: false, message: "Worker configuration is incomplete." }, 500, origin, allowedOrigin);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return jsonResponse({ ok: false, message: "Invalid JSON request." }, 400, origin, allowedOrigin);
    }

    if (!input || !ALLOWED_ACTIONS.has(input.action)) {
      return jsonResponse({ ok: false, message: "Unknown action." }, 400, origin, allowedOrigin);
    }

    // Keep the browser from choosing the secret or arbitrary GAS parameters.
    const payload = {
      action: input.action,
      workerSecret: env.GAS_SHARED_SECRET
    };

    if (input.action === "login") {
      payload.username = String(input.username || "");
      payload.password = String(input.password || "");
    } else {
      payload.token = String(input.token || "");
    }

    try {
      const upstream = await fetch(env.GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "follow"
      });

      if (!upstream.ok) {
        return jsonResponse({ ok: false, message: "Backend request failed." }, 502, origin, allowedOrigin);
      }

      const raw = await upstream.text();
      let result;
      try {
        result = JSON.parse(raw);
      } catch {
        return jsonResponse({ ok: false, message: "Backend returned an invalid response." }, 502, origin, allowedOrigin);
      }

      return jsonResponse(result, 200, origin, allowedOrigin);
    } catch {
      return jsonResponse({ ok: false, message: "Could not reach the backend." }, 502, origin, allowedOrigin);
    }
  }
};

function isAllowedOrigin(origin, allowedOrigin) {
  return Boolean(origin && allowedOrigin && origin === allowedOrigin);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function jsonResponse(data, status, origin, allowedOrigin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  };
  if (isAllowedOrigin(origin, allowedOrigin)) {
    Object.assign(headers, corsHeaders(origin));
  }
  return new Response(JSON.stringify(data), { status, headers });
}
