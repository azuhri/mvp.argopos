import type { Connect, Plugin } from "vite";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Keep local browser navigation on the same host used by CORS and payment
// cookies. This middleware never forwards API requests or copies browser data.
export function localFrontendOriginMiddleware(frontendUrl: string | undefined): Connect.NextHandleFunction {
  let target: URL | undefined;
  try {
    const parsed = new URL(frontendUrl || "");
    if (parsed.protocol === "http:" && loopbackHosts.has(parsed.hostname) &&
        !parsed.username && !parsed.password && parsed.pathname === "/" && !parsed.search && !parsed.hash) {
      target = parsed;
    }
  } catch { /* Unconfigured/nonlocal deployments do not need alias redirection. */ }

  return (request, response, next) => {
    if (!target || !["GET", "HEAD"].includes(request.method || "") ||
        !request.headers.accept?.includes("text/html") || !request.headers.host ||
        !request.url?.startsWith("/")) return next();

    let current: URL;
    try { current = new URL(`http://${request.headers.host}`); } catch { return next(); }
    if (!loopbackHosts.has(current.hostname) || current.hostname === target.hostname ||
        current.port !== target.port) return next();

    // Prefix the trusted origin instead of resolving a request path as a URL:
    // even a path beginning // must never become a redirect to another host.
    response.writeHead(302, {
      Location: `${target.origin}${request.url}`,
      "Cache-Control": "no-store",
    });
    response.end();
  };
}

export function localFrontendOrigin(frontendUrl: string | undefined): Plugin {
  return {
    name: "celestia-local-frontend-origin",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(localFrontendOriginMiddleware(frontendUrl));
    },
  };
}
