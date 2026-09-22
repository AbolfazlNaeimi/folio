/**
 * Minimal GitHub OAuth relay for Decap CMS, running on Cloudflare Workers.
 *
 * GitHub Pages can only serve static files — it can't run the server-side
 * code needed to complete an OAuth login. This Worker is that missing
 * piece: it only ever proxies the GitHub OAuth handshake (redirect to
 * GitHub, exchange the returned code for a token, hand the token back to
 * the CMS tab). It never touches your repo content directly — Decap CMS
 * itself talks to the GitHub API using the token this Worker hands it.
 *
 * Routes:
 *   GET /auth      → redirects the browser to GitHub's OAuth consent screen
 *   GET /callback  → exchanges the returned code for an access token, then
 *                    posts it back to the Decap CMS tab that opened this popup
 *
 * Required Worker secrets (set with `wrangler secret put <NAME>`):
 *   GITHUB_CLIENT_ID
 *   GITHUB_CLIENT_SECRET
 */

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const SCOPE = "repo,user";

function randomState() {
  return crypto.randomUUID();
}

async function handleAuth(request, env) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/callback`;
  const state = randomState();

  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", SCOPE);
  authorizeUrl.searchParams.set("state", state);

  const response = Response.redirect(authorizeUrl.toString(), 302);
  const headers = new Headers(response.headers);
  // Store state in a short-lived cookie to check on callback (basic CSRF guard)
  headers.append(
    "Set-Cookie",
    `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );
  return new Response(null, { status: 302, headers });
}

function popupResponseHtml(status, payload) {
  // Matches the exact handshake Decap CMS's popup-window auth listener expects.
  const message =
    status === "success"
      ? `authorization:github:success:${JSON.stringify(payload)}`
      : `authorization:github:error:${JSON.stringify(payload)}`;

  return `<!DOCTYPE html>
<html><body>
<script>
  (function () {
    function receiveMessage(e) {
      window.removeEventListener("message", receiveMessage, false);
      window.opener.postMessage(
        ${JSON.stringify(message)},
        e.origin
      );
    }
    window.addEventListener("message", receiveMessage, false);
    window.opener.postMessage("authorizing:github", "*");
  })();
</script>
</body></html>`;
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("Cookie") || "";
  const savedState = (cookie.match(/oauth_state=([^;]+)/) || [])[1];

  if (!code) {
    return new Response(popupResponseHtml("error", { message: "Missing code" }), {
      headers: { "Content-Type": "text/html" },
    });
  }
  if (!state || state !== savedState) {
    return new Response(popupResponseHtml("error", { message: "Invalid state" }), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/callback`,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    return new Response(popupResponseHtml("error", tokenData), {
      headers: { "Content-Type": "text/html" },
    });
  }

  return new Response(
    popupResponseHtml("success", { token: tokenData.access_token, provider: "github" }),
    { headers: { "Content-Type": "text/html" } }
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") return handleAuth(request, env);
    if (url.pathname === "/callback") return handleCallback(request, env);

    return new Response("Decap CMS OAuth relay — not a content endpoint.", { status: 404 });
  },
};
