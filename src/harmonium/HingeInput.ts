export type HingeReading = {
  angle: number;
  timestamp: number;
  intervalMs: number | null;
  readingsPerSecond: number | null;
};

export type HingeStatus = {
  kind: "idle" | "connecting" | "connected" | "unavailable" | "error";
  message: string;
};

// WebHID is not in TypeScript's standard DOM declarations. Keep this read-only
// sensor contract local, without a package or APIs for writing sensor settings.
type SensorCollection = {
  usagePage: number;
  usage: number;
  children?: SensorCollection[];
};

type SensorDevice = {
  vendorId: number;
  productId: number;
  collections: SensorCollection[];
  opened: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  addEventListener(type: "inputreport", listener: (event: Event) => void): void;
  removeEventListener(type: "inputreport", listener: (event: Event) => void): void;
};

type SensorHid = {
  requestDevice(options: {
    filters: { vendorId: number; productId: number; usagePage: number; usage: number }[];
  }): Promise<SensorDevice[]>;
  addEventListener(type: "disconnect", listener: (event: Event) => void): void;
  removeEventListener(type: "disconnect", listener: (event: Event) => void): void;
};

type SensorInputEvent = Event & { device: SensorDevice; reportId: number; data: DataView };
type SensorConnectionEvent = Event & { device: SensorDevice };

const SENSOR_FILTER = { vendorId: 0x05ac, productId: 0x8104, usagePage: 0x20, usage: 0x8a };

function hidApi(): SensorHid | undefined {
  return typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & { hid?: SensorHid }).hid;
}

function hasAngleCollection(collections: SensorCollection[]): boolean {
  return collections.some((collection) =>
    (collection.usagePage === SENSOR_FILTER.usagePage && collection.usage === SENSOR_FILTER.usage)
    || hasAngleCollection(collection.children ?? []),
  );
}

/** Reads the Apple lid-angle sensor only after an explicit user connection. */
export class HingeInput {
  private device: SensorDevice | null = null;
  private pendingDevice: SensorDevice | null = null;
  private rememberedDevice: SensorDevice | null = null;
  private api: SensorHid | null = null;
  private generation = 0;
  private connecting = false;
  private disposed = false;
  private previousTimestamp: number | null = null;
  private timestamps: number[] = [];
  private closing: Promise<void> = Promise.resolve();

  constructor(
    private readonly onReading: (reading: HingeReading) => void,
    private readonly onStatus: (status: HingeStatus) => void,
  ) {}

  static availability(): string | null {
    if (typeof window === "undefined" || !window.isSecureContext) {
      return "Hinge control needs HTTPS or localhost. Manual bellows are available.";
    }
    if (!hidApi()) {
      return "This browser does not support WebHID. Try Chrome or Edge on a compatible MacBook, or use manual bellows.";
    }
    return null;
  }

  async connect(): Promise<void> {
    if (this.disposed || this.connecting || this.device) return;
    const unavailable = HingeInput.availability();
    const api = hidApi();
    if (unavailable || !api) {
      this.onStatus({ kind: "unavailable", message: unavailable ?? "WebHID is unavailable." });
      return;
    }

    const generation = ++this.generation;
    this.connecting = true;
    this.onStatus({ kind: "connecting", message: "Select the Apple lid-angle sensor if it is offered by your browser." });
    let chosen: SensorDevice | undefined;
    try {
      // Call the chooser before an await so the original click's user activation
      // is preserved. A remembered sensor is reopened only on an explicit click.
      chosen = this.rememberedDevice ?? (await api.requestDevice({ filters: [SENSOR_FILTER] }))[0];
      if (!this.isCurrent(generation)) {
        if (chosen) this.closeLateDevice(chosen);
        return;
      }
      if (!chosen) {
        this.connecting = false;
        this.onStatus({ kind: "idle", message: "No hinge sensor selected. You can use manual bellows." });
        return;
      }
      if (chosen.vendorId !== SENSOR_FILTER.vendorId
        || chosen.productId !== SENSOR_FILTER.productId
        || !hasAngleCollection(chosen.collections)) {
        this.connecting = false;
        this.onStatus({ kind: "error", message: "The selected device is not the supported Apple lid-angle sensor." });
        return;
      }

      this.rememberedDevice = chosen;
      this.pendingDevice = chosen;
      this.api = api;
      api.addEventListener("disconnect", this.onDeviceDisconnect);
      await this.closing;
      if (!this.isCurrent(generation)) {
        this.closeLateDevice(chosen);
        return;
      }
      if (!chosen.opened) await chosen.open();
      if (!this.isCurrent(generation)) {
        this.closeLateDevice(chosen);
        return;
      }

      this.pendingDevice = null;
      this.device = chosen;
      this.connecting = false;
      this.resetReadings();
      chosen.addEventListener("inputreport", this.onInputReport);
      this.onStatus({ kind: "connected", message: "Sensor opened. Move the lid to check whether angle readings arrive." });
    } catch (error) {
      if (!this.isCurrent(generation)) {
        if (chosen) this.closeLateDevice(chosen);
        return;
      }
      this.connecting = false;
      this.pendingDevice = null;
      this.removeDisconnectListener();
      if (chosen) this.queueClose(chosen);
      const cancelled = error instanceof DOMException && error.name === "NotFoundError";
      this.onStatus(cancelled
        ? { kind: "idle", message: "No hinge sensor selected. You can use manual bellows." }
        : { kind: "error", message: "The browser could not open the hinge sensor. Try connecting again, or use manual bellows." });
    }
  }

  disconnect(): void {
    if (this.disposed) return;
    this.releaseConnection();
    this.onStatus({ kind: "idle", message: "Hinge sensor disconnected. Manual bellows are available." });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.releaseConnection();
    this.rememberedDevice = null;
  }

  private isCurrent(generation: number): boolean {
    return !this.disposed && this.generation === generation;
  }

  private onInputReport = (event: Event): void => {
    const report = event as SensorInputEvent;
    if (this.disposed || !this.device || report.device !== this.device
      || report.reportId !== 1 || report.data.byteLength !== 2) return;
    // WebHID's data excludes the report ID. The two-byte value is degrees,
    // little endian; ignore malformed/out-of-range readings entirely.
    const angle = report.data.getUint16(0, true);
    if (angle > 360) return;

    const timestamp = performance.now();
    const intervalMs = this.previousTimestamp === null ? null : timestamp - this.previousTimestamp;
    this.previousTimestamp = timestamp;
    this.timestamps = this.timestamps.filter((time) => time >= timestamp - 5000);
    this.timestamps.push(timestamp);
    const elapsed = timestamp - this.timestamps[0];
    const readingsPerSecond = this.timestamps.length > 1 && elapsed > 0
      ? (this.timestamps.length - 1) * 1000 / elapsed
      : null;
    this.onReading({ angle, timestamp, intervalMs, readingsPerSecond });
  };

  private onDeviceDisconnect = (event: Event): void => {
    const disconnected = (event as SensorConnectionEvent).device;
    if (disconnected !== this.device && disconnected !== this.pendingDevice) return;
    this.rememberedDevice = null;
    this.releaseConnection();
    if (!this.disposed) {
      this.onStatus({ kind: "idle", message: "The hinge sensor was disconnected. Reconnect it explicitly, or use manual bellows." });
    }
  };

  private releaseConnection(): void {
    ++this.generation;
    this.connecting = false;
    const device = this.device;
    this.device = null;
    this.pendingDevice = null;
    if (device) {
      device.removeEventListener("inputreport", this.onInputReport);
      this.queueClose(device);
    }
    // An in-flight open is closed by its own completion after its token expires.
    this.removeDisconnectListener();
    this.resetReadings();
  }

  private removeDisconnectListener(): void {
    this.api?.removeEventListener("disconnect", this.onDeviceDisconnect);
    this.api = null;
  }

  private resetReadings(): void {
    this.previousTimestamp = null;
    this.timestamps = [];
  }

  private closeLateDevice(device: SensorDevice): void {
    // A newer explicit connection may already be using the same HID object.
    if (device !== this.device && device !== this.pendingDevice) this.queueClose(device);
  }

  private queueClose(device: SensorDevice): void {
    this.closing = this.closing
      .then(() => device.close())
      .catch(() => { /* A physically disconnected sensor can reject close(). */ });
  }
}
