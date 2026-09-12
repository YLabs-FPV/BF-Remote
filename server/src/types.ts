import type { Kind } from "@bf-remote/shared";

export interface Attachment {
  id: string;
  kind: Kind;
  name: string;
  hasControl: boolean;
  /** For the FC bridge: whether the physical flight controller is currently connected. */
  online?: boolean;
}
