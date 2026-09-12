import {
  APP_SUBPROTOCOL,
  type ClientMessage,
  type Peer,
  type ServerMessage,
} from "@bf-remote/shared";
import { formatCode, shareUrl, wsBase } from "./code";

export type Status = "idle" | "connecting" | "sharing" | "error";

const VENDOR_NAMES: Record<number, string> = {
  0x0483: "STM32",
  0x10c4: "CP210x",
  0x1a86: "CH340",
  0x0403: "FTDI",
};

function portLabel(port: SerialPort): string {
  const info = port.getInfo();
  if (info.usbVendorId == null) return "Serial device";
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");
  const ids = `${hex(info.usbVendorId)}:${hex(info.usbProductId ?? 0)}`;
  const name = VENDOR_NAMES[info.usbVendorId];
  return name ? `${name} (${ids})` : `USB ${ids}`;
}

class Session {
  status = $state<Status>("idle");
  code = $state<string | null>(null);
  error = $state<string | null>(null);
  peers = $state<Peer[]>([]);
  holder = $state<string | null>(null);
  fcOnline = $state(true);
  reconnecting = $state(false);
  ports = $state<{ id: string; label: string }[]>([]);
  selectedId = $state<string | null>(null);

  #ws: WebSocket | null = null;
  #port: SerialPort | null = null;
  #lastPort: SerialPort | null = null;
  #lastInfo: SerialPortInfo | null = null;
  #reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  #writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  #writeChain: Promise<void> = Promise.resolve();
  #reading = false;

  #bytesFromFc = 0;
  #bytesToFc = 0;
  #startedAt: number | null = null;
  #latencyMs: number | null = null;
  #pingSentAt = 0;
  #pingTimer: ReturnType<typeof setInterval> | null = null;

  #portsById = new Map<string, SerialPort>();
  #portKeys = new WeakMap<SerialPort, string>();
  #portKeySeq = 0;

  constructor() {
    if (navigator.serial) {
      navigator.serial.addEventListener("connect", (e) => {
        this.#onDevicePresent(e);
        this.refreshPorts();
      });
      navigator.serial.addEventListener("disconnect", () =>
        this.refreshPorts(),
      );
      this.refreshPorts();
    }
  }

  async refreshPorts(): Promise<void> {
    if (!navigator.serial) return;
    const granted = await navigator.serial.getPorts();
    const usable = granted.filter(
      (p) => (p as { connected?: boolean }).connected !== false,
    );
    this.#portsById.clear();
    this.ports = usable.map((p) => {
      const id = this.#keyFor(p);
      this.#portsById.set(id, p);
      return { id, label: portLabel(p) };
    });
    if (!this.selectedId || !this.#portsById.has(this.selectedId)) {
      this.selectedId = this.ports[0]?.id ?? null;
    }
  }

  select(id: string): void {
    this.selectedId = id;
  }

  async addDevice(): Promise<void> {
    if (!navigator.serial) return;
    let port: SerialPort;
    try {
      port = await navigator.serial.requestPort();
    } catch {
      return; // picker dismissed
    }
    await this.refreshPorts();
    this.selectedId = this.#keyFor(port);
  }

  #keyFor(port: SerialPort): string {
    let key = this.#portKeys.get(port);
    if (!key) {
      key = `p${this.#portKeySeq++}`;
      this.#portKeys.set(port, key);
    }
    return key;
  }

  get serialSupported(): boolean {
    return !!navigator.serial;
  }

  get helpers(): Peer[] {
    return this.peers.filter((p) => p.kind === "plain");
  }

  get shareUrl(): string | null {
    return this.code ? shareUrl(this.code) : null;
  }

  get displayCode(): string | null {
    return this.code ? formatCode(this.code) : null;
  }

  get bytesFromFc(): number {
    return this.#bytesFromFc;
  }

  get bytesToFc(): number {
    return this.#bytesToFc;
  }

  get uptimeMs(): number {
    return this.#startedAt ? Date.now() - this.#startedAt : 0;
  }

  get latencyMs(): number | null {
    return this.#latencyMs;
  }

  async start(): Promise<void> {
    if (!navigator.serial) {
      this.status = "error";
      this.error = "Web Serial isn't available. Use Chrome or Edge on desktop.";
      return;
    }

    const selected = this.selectedId
      ? this.#portsById.get(this.selectedId)
      : null;
    const port = selected ?? (await this.#resolvePort("auto"));
    if (!port) return; // no device chosen

    this.status = "connecting";
    this.error = null;

    try {
      const res = await fetch("/api/new");
      const { code } = (await res.json()) as { code: string };
      this.code = code;
      await this.#openWs(code);
    } catch {
      this.error =
        "Couldn't reach the relay. Check your connection and try again.";
      this.status = "error";
      await this.#teardownAll();
      return;
    }

    try {
      await this.#attachSerial(port);
    } catch {
      this.error =
        "Couldn't open the flight controller. Disconnect it from Betaflight first, then try again.";
      this.status = "error";
      await this.#teardownAll();
    }
  }

  async reconnectFc(forcePick = false): Promise<void> {
    if (this.status !== "sharing" || this.fcOnline || this.reconnecting) return;

    const port = await this.#resolvePort(forcePick ? "prompt" : "auto");
    if (!port) return;

    this.reconnecting = true;
    this.error = null;
    const ok = await this.#tryAttach(port, 3);
    if (!ok) this.error = "Couldn't reconnect to the flight controller.";
    this.reconnecting = false;
  }

  grant(id: string): void {
    this.#send({ t: "grant", to: id });
  }

  revoke(): void {
    this.#send({ t: "revoke" });
  }

  async stop(): Promise<void> {
    await this.#teardownAll();
    this.status = "idle";
    this.code = null;
    this.peers = [];
    this.holder = null;
    this.fcOnline = true;
    this.#bytesFromFc = 0;
    this.#bytesToFc = 0;
    this.#startedAt = null;
    this.#latencyMs = null;
  }

  async #resolvePort(mode: "auto" | "prompt"): Promise<SerialPort | null> {
    if (mode === "auto") {
      const granted = await navigator.serial.getPorts();
      const usable = granted.filter(
        (p) => (p as { connected?: boolean }).connected !== false,
      );
      const port =
        this.#lastPort && usable.includes(this.#lastPort)
          ? this.#lastPort
          : usable.length === 1
            ? usable[0]
            : null;
      if (port) return port;
    }
    // Nothing obvious to reuse, or the user asked to choose → show the picker.
    try {
      return await navigator.serial.requestPort();
    } catch {
      return null; // picker dismissed
    }
  }

  #onDevicePresent(e: Event): void {
    if (this.status !== "sharing" || this.fcOnline || this.reconnecting) return;
    const port = e.target as SerialPort;
    if (!this.#matchesLast(port)) return; // a different device - not our FC

    this.reconnecting = true;
    this.#tryAttach(port, 6).finally(() => {
      this.reconnecting = false;
    });
  }

  #matchesLast(port: SerialPort): boolean {
    if (this.#lastPort && port === this.#lastPort) return true;
    if (this.#lastInfo) {
      const info = port.getInfo();
      return (
        info.usbVendorId === this.#lastInfo.usbVendorId &&
        info.usbProductId === this.#lastInfo.usbProductId
      );
    }
    return true;
  }

  /** Open the port, retrying briefly - a just-replugged device needs a moment. */
  async #tryAttach(port: SerialPort, retries: number): Promise<boolean> {
    for (let i = 0; i <= retries; i++) {
      try {
        await this.#attachSerial(port);
        return true;
      } catch {
        if (i < retries) await new Promise((r) => setTimeout(r, 300));
      }
    }
    return false;
  }

  #openWs(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${wsBase()}/ws/${code}?role=fc`, [
        APP_SUBPROTOCOL,
      ]);
      ws.binaryType = "arraybuffer";
      this.#ws = ws;

      ws.onopen = () => {
        this.status = "sharing";
        this.#startedAt = Date.now();
        this.#pingTimer = setInterval(() => {
          if (this.#ws?.readyState === WebSocket.OPEN) {
            this.#pingSentAt = performance.now();
            this.#ws.send("ping");
          }
        }, 5000);
        resolve();
      };
      ws.onmessage = (e) => {
        if (typeof e.data === "string") {
          if (e.data === "pong") {
            this.#latencyMs = Math.round(performance.now() - this.#pingSentAt);
            return;
          }
          this.#onControl(JSON.parse(e.data) as ServerMessage);
        } else {
          this.#toSerial(new Uint8Array(e.data as ArrayBuffer));
        }
      };
      ws.onerror = () => {
        this.error = "Relay connection error.";
      };
      ws.onclose = () => {
        this.#ws = null;
        if (this.status === "connecting") {
          reject(new Error("Couldn't reach the relay."));
        } else if (this.status === "sharing") {
          this.stop(); // real relay loss ends the session
        }
      };
    });
  }

  #onControl(msg: ServerMessage): void {
    switch (msg.t) {
      case "welcome":
      case "peers":
        this.peers = msg.peers;
        break;
      case "control":
        this.holder = msg.holder;
        break;
      case "error":
        this.error = msg.message;
        break;
    }
  }

  #send(msg: ClientMessage): void {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify(msg));
    }
  }

  async #attachSerial(port: SerialPort): Promise<void> {
    await port.open({ baudRate: 115200 });
    this.#port = port;
    this.#lastPort = port;
    this.#lastInfo = port.getInfo();
    this.#writer = port.writable!.getWriter();
    this.#writeChain = Promise.resolve();
    port.addEventListener("disconnect", this.#onFcLost);

    this.fcOnline = true;
    this.#send({ t: "fcState", online: true });

    this.#reading = true;
    this.#readLoop();
  }

  #onFcLost = (): void => {
    if (!this.fcOnline) return; // already handled
    this.fcOnline = false;
    this.#teardownSerial();
    this.#send({ t: "fcState", online: false });
  };

  async #readLoop(): Promise<void> {
    const readable = this.#port?.readable;
    if (!readable) return;
    const reader = readable.getReader();
    this.#reader = reader;
    try {
      while (this.#reading) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && this.#ws?.readyState === WebSocket.OPEN) {
          this.#bytesFromFc += value.byteLength;
          this.#ws.send(value as Uint8Array<ArrayBuffer>);
        }
      }
    } catch {
      /* read error - FC unplugged */
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* already released */
      }
      this.#reader = null;
    }
    if (this.#reading) this.#onFcLost();
  }

  #toSerial(bytes: Uint8Array): void {
    const w = this.#writer;
    if (!w) return;
    this.#bytesToFc += bytes.byteLength;
    this.#writeChain = this.#writeChain
      .then(() => w.write(bytes))
      .catch(() => {});
  }

  async #teardownSerial(): Promise<void> {
    this.#reading = false;
    const port = this.#port;
    port?.removeEventListener("disconnect", this.#onFcLost);
    try {
      await this.#reader?.cancel();
    } catch {
      /* ignore */
    }
    this.#reader = null;
    try {
      this.#writer?.releaseLock();
    } catch {
      /* ignore */
    }
    this.#writer = null;
    try {
      await port?.close();
    } catch {
      /* device already gone */
    }
    this.#port = null;
  }

  async #teardownAll(): Promise<void> {
    await this.#teardownSerial();
    if (this.#pingTimer) {
      clearInterval(this.#pingTimer);
      this.#pingTimer = null;
    }
    try {
      this.#ws?.close();
    } catch {
      /* ignore */
    }
    this.#ws = null;
  }
}

export const session = new Session();
