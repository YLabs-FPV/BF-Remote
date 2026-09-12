import type { Kind, Peer } from "@bf-remote/shared";
import type { Attachment } from "../types";

export function attach(ws: WebSocket): Attachment {
  return ws.deserializeAttachment() as Attachment;
}

export function toPeer(a: Attachment): Peer {
  return { id: a.id, kind: a.kind, name: a.name, hasControl: a.hasControl };
}

export function defaultName(kind: Kind): string {
  return kind === "fc" ? "Flight controller" : "Configurator";
}
