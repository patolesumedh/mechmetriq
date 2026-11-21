export default {
  async fetch(request, env) {
    const incomingUrl = new URL(request.url);
    const publicHost = incomingUrl.hostname;
    const originHost = env.CLOUD_RUN_HOST; // e.g., mechonehub-web-xxxxxxxx-el.a.run.app

    // Hardening 1: internal callback path is never reachable through the public edge
    if (incomingUrl.pathname.startsWith("/api/internal/")) {
      return new Response("Not found", { status: 404 });
    }

    const targetUrl = new URL(request.url);
    targetUrl.hostname = originHost;
    targetUrl.protocol = "https:";

    const headers = new Headers(request.headers);
    // Hardening 2: never trust client-supplied forwarding/verification headers
    for (const h of [
      "x-origin-verify",
      "x-forwarded-for",
      "x-forwarded-host",
      "x-forwarded-proto",
      "x-real-ip",
    ]) {
      headers.delete(h);
    }
    headers.set("Host", originHost);
    headers.set("X-Forwarded-Host", publicHost);
    headers.set("X-Forwarded-Proto", "https");
    headers.set("X-Origin-Verify", String(env.ORIGIN_VERIFY_SECRET ?? "").trim());

    const clientIp = request.headers.get("CF-Connecting-IP");
    if (clientIp) {
      headers.set("X-Forwarded-For", clientIp);
    }

    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const originRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: "manual",
    });

    const response = await fetch(originRequest);
    const respHeaders = new Headers(response.headers);

    // Rewrite any Location redirect leaking the internal *.a.run.app URL
    const location = respHeaders.get("Location");
    if (location && location.includes(originHost)) {
      respHeaders.set("Location", location.replaceAll(originHost, publicHost));
    }

    // Preserve all chunked @supabase/ssr Set-Cookie headers intact
    const cookies = response.headers.getSetCookie?.() ?? [];
    if (cookies.length > 0) {
      respHeaders.delete("Set-Cookie");
      const domainRe = new RegExp(`domain=\\.?${originHost.replaceAll(".", "\\.")}`, "i");
      for (const cookie of cookies) {
        respHeaders.append("Set-Cookie", cookie.replace(domainRe, `domain=${publicHost}`));
      }
    }

    // Hardening 3: don't leak origin/platform details
    respHeaders.delete("x-powered-by");
    respHeaders.delete("server");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  },
};
