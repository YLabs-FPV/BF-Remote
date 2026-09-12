export * from "./codes";
export * from "./subprotocols";

export type Kind = "fc" | "plain";

export interface Peer {
  id: string;
  kind: Kind;
  name: string;
  hasControl: boolean;
}

export interface SessionStatus {
  fc: boolean;
  helpers: number;
}

export type ClientMessage =
  | { t: "setName"; name: string }
  | { t: "grant"; to: string }
  | { t: "revoke" }
  | { t: "fcState"; online: boolean };

export type ServerMessage =
  | { t: "welcome"; you: Peer; peers: Peer[] }
  | { t: "peers"; peers: Peer[] }
  | { t: "control"; holder: string | null }
  | { t: "error"; message: string };
