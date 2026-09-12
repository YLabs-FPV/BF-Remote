import { DurableObject } from "cloudflare:workers";
import {
  APP_SUBPROTOCOL,
  BINARY_SUBPROTOCOL,
  type ClientMessage,
  type Kind,
  type Peer,
  type ServerMessage,
  type SessionStatus,
} from "@bf-remote/shared";
import type { Attachment } from "./types";
import { attach, defaultName, toPeer } from "./utils/attachment";

export interface Env {
  RELAY: DurableObjectNamespace<SessionRelay>;
  ASSETS: Fetcher;
}

const IDLE_TTL_MS = 10 * 60_000;

export class SessionRelay extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
  }

  status(): SessionStatus {
    const fcSock = this.socketsOfKind("fc")[0];
    return {
      fc: fcSock ? attach(fcSock).online !== false : false,
      helpers: this.socketsOfKind("plain").length,
    };
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const role = url.searchParams.get("role");
    const name = (url.searchParams.get("name") ?? "").slice(0, 40);
    const requested = (req.headers.get("Sec-WebSocket-Protocol") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (role === "fc" && this.socketsOfKind("fc").length > 0) {
      return new Response("Session already has an FC connected", {
        status: 409,
      });
    }

    const kind: Kind = role === "fc" ? "fc" : "plain";
    const selected =
      kind === "fc"
        ? APP_SUBPROTOCOL
        : requested.includes(BINARY_SUBPROTOCOL)
          ? BINARY_SUBPROTOCOL
          : undefined;

    const { 0: client, 1: server } = new WebSocketPair();

    const attachment = {
      id: crypto.randomUUID(),
      kind,
      name: name || defaultName(kind),
      hasControl: kind === "plain" && !this.controller(),
      online: kind === "fc",
    };
    server.serializeAttachment(attachment);

    this.ctx.acceptWebSocket(server, [kind]);
    this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);

    if (kind === "fc") {
      this.send(server, {
        t: "welcome",
        you: toPeer(attachment),
        peers: this.roster(),
      });
    }
    this.broadcastJson({ t: "peers", peers: this.roster() }, server);
    if (attachment.hasControl) {
      this.broadcastJson({ t: "control", holder: attachment.id });
    }

    const headers: HeadersInit = selected
      ? { "Sec-WebSocket-Protocol": selected }
      : {};
    return new Response(null, { status: 101, webSocket: client, headers });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message === "string") {
      this.handleControl(ws, message);
    } else {
      this.relayMsp(ws, message);
    }
  }

  private relayMsp(ws: WebSocket, data: ArrayBuffer): void {
    const from = attach(ws);
    if (from.kind === "fc") {
      this.controller()?.send(data);
    } else if (from.hasControl) {
      this.fc()?.send(data);
    }
  }

  private handleControl(ws: WebSocket, raw: string): void {
    if (attach(ws).kind !== "fc") {
      return;
    }

    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.send(ws, { t: "error", message: "invalid JSON" });
      return;
    }

    switch (msg.t) {
      case "setName":
        this.mutate(ws, (a) => (a.name = msg.name.slice(0, 40) || a.name));
        this.broadcastJson({ t: "peers", peers: this.roster() });
        break;
      case "grant": {
        const target = this.byId(msg.to);
        if (!target || attach(target).kind !== "plain") {
          this.send(ws, {
            t: "error",
            message: `no connectable peer ${msg.to}`,
          });
          return;
        }
        this.assignControl(target);
        break;
      }
      case "revoke":
        this.assignControl(null);
        break;
      case "fcState":
        this.mutate(ws, (a) => (a.online = msg.online));
        if (!msg.online) {
          // FC unplugged: drop every Configurator (they disconnect as on real USB),
          // but keep the bridge socket so the session and code survive.
          for (const s of this.socketsOfKind("plain")) {
            try {
              s.close(1001, "FC disconnected");
            } catch {
              /* already closing */
            }
          }
        }
        this.broadcastJson({ t: "peers", peers: this.roster() });
        break;
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.onGone(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.onGone(ws);
  }

  private onGone(ws: WebSocket): void {
    const gone = attach(ws);

    if (gone.kind === "fc") {
      for (const s of this.socketsOfKind("plain")) {
        try {
          s.close(1001, "FC disconnected");
        } catch {
          /* already closing */
        }
      }
      return;
    }

    if (gone.hasControl) {
      const rest = this.socketsOfKind("plain").filter((s) => s !== ws);
      this.assignControl(rest.length === 1 ? rest[0] : null);
    }
    this.broadcastJson({ t: "peers", peers: this.roster() }, ws);
  }

  async alarm(): Promise<void> {
    if (this.ctx.getWebSockets().length === 0) {
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);
  }

  private assignControl(ws: WebSocket | null): void {
    for (const s of this.ctx.getWebSockets()) {
      const want = s === ws;
      if (attach(s).hasControl !== want) {
        this.mutate(s, (a) => (a.hasControl = want));
      }
    }
    this.broadcastJson({ t: "control", holder: ws ? attach(ws).id : null });
    this.broadcastJson({ t: "peers", peers: this.roster() });
  }

  private controller(): WebSocket | undefined {
    return this.socketsOfKind("plain").find((s) => attach(s).hasControl);
  }

  private fc(): WebSocket | undefined {
    return this.socketsOfKind("fc")[0];
  }

  private byId(id: string): WebSocket | undefined {
    return this.ctx.getWebSockets().find((s) => attach(s).id === id);
  }

  private socketsOfKind(kind: Kind): WebSocket[] {
    return this.ctx.getWebSockets(kind);
  }

  private roster(): Peer[] {
    return this.ctx.getWebSockets().map((s) => toPeer(attach(s)));
  }

  private mutate(ws: WebSocket, fn: (a: Attachment) => void): void {
    const a = attach(ws);
    fn(a);
    ws.serializeAttachment(a);
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket already closing */
    }
  }

  private broadcastJson(msg: ServerMessage, except?: WebSocket): void {
    const text = JSON.stringify(msg);
    for (const s of this.socketsOfKind("fc")) {
      if (s === except) {
        continue;
      }
      try {
        s.send(text);
      } catch {
        /* ignore */
      }
    }
  }
}
