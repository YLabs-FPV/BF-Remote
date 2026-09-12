import { isValidCode, newCode } from "@bf-remote/shared";
import { SessionRelay, type Env } from "./SessionRelay";

export { SessionRelay };

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/api/new") {
      return Response.json({ code: newCode() });
    }

    const status = url.pathname.match(/^\/api\/session\/([^/]+)$/);
    if (status) {
      const code = decodeURIComponent(status[1]).toLowerCase();
      if (!isValidCode(code)) {
        return new Response("Bad session code", { status: 400 });
      }
      return Response.json(await env.RELAY.getByName(code).status());
    }

    const m = url.pathname.match(/^\/ws\/([^/]+)$/);
    if (m) {
      const code = decodeURIComponent(m[1]).toLowerCase();
      if (req.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }
      if (!isValidCode(code)) {
        return new Response("Bad session code", { status: 400 });
      }
      return env.RELAY.getByName(code).fetch(req);
    }

    if (url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }

    return env.ASSETS.fetch(req);
  },
};
