import { readPreference, writePreference } from "../preferences";

const savedVolume = readPreference("volume");
let volume = typeof savedVolume === "number" && Number.isFinite(savedVolume)
  ? Math.max(0, Math.min(1, savedVolume)) : 1;
const volumeListeners = new Set<() => void>();
type Output = { context: AudioContext; gain: GainNode };
const outputs = new Set<Output>();
let recording: SessionRecorder | null = null;

export const getOutputVolume = (): number => volume;
export function subscribeOutputVolume(listener: () => void): () => void {
  volumeListeners.add(listener);
  return () => { volumeListeners.delete(listener); };
}
export function setOutputVolume(value: number): void {
  if (!Number.isFinite(value)) return;
  volume = Math.max(0, Math.min(1, value));
  writePreference("volume", volume);
  for (const output of outputs) {
    if (output.context.state !== "closed") {
      output.gain.gain.setTargetAtTime(volume, output.context.currentTime, 0.012);
    }
  }
  for (const listener of volumeListeners) listener();
}

/** Preserve each engine's dynamics, then apply the shared listening volume. */
export function connectAudioOutput(context: AudioContext, node: AudioNode): () => void {
  const gain = context.createGain();
  gain.gain.value = volume;
  node.connect(gain).connect(context.destination);
  const output = { context, gain };
  outputs.add(output);
  recording?.attach(output);
  let disconnected = false;
  return () => {
    if (disconnected) return;
    disconnected = true;
    recording?.detach(output);
    outputs.delete(output);
    try { node.disconnect(gain); } catch { /* Context may already be closed. */ }
    gain.disconnect();
  };
}

export const MAX_TAKE_SECONDS = 180;
const MAX_TAKE_BYTES = 12 * 1024 * 1024;
export function canRecordSession(): boolean {
  return typeof AudioContext !== "undefined" && typeof MediaRecorder !== "undefined"
    && "createMediaStreamDestination" in AudioContext.prototype;
}

type Capture = { destination: MediaStreamAudioDestinationNode; source: MediaStreamAudioSourceNode };

/** Capture synthesized outputs only. No microphone or device permission is used. */
export class SessionRecorder {
  private readonly context: AudioContext;
  private readonly destination!: MediaStreamAudioDestinationNode;
  private readonly silence!: ConstantSourceNode;
  private readonly recorder!: MediaRecorder;
  private readonly captures = new Map<Output, Capture>();
  private readonly chunks: Blob[] = [];
  private bytes = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private finished = false;
  private stopping = false;
  private discarded = false;
  private error: string | null = null;

  constructor(private readonly onComplete: (blob: Blob | null, error: string | null) => void) {
    if (!canRecordSession()) throw new Error("Audio recording is unavailable in this browser.");
    if (recording) throw new Error("A recording is already running.");
    this.context = new AudioContext({ latencyHint: "interactive" });
    try {
      this.destination = this.context.createMediaStreamDestination();
      // Keep a live recording track even when Record is pressed before a note.
      this.silence = this.context.createConstantSource();
      this.silence.offset.value = 0;
      this.silence.connect(this.destination);
      this.silence.start();
      const mimeType = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      this.recorder = new MediaRecorder(this.destination.stream, {
        ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 128000,
      });
      this.recorder.ondataavailable = (event) => {
        if (this.finished || this.discarded || !event.data.size) return;
        if (this.bytes + event.data.size > MAX_TAKE_BYTES) {
          this.error = "Recording reached its size limit. Try a shorter take.";
          this.discarded = true;
          this.chunks.length = 0;
          this.stop();
          return;
        }
        this.bytes += event.data.size;
        this.chunks.push(event.data);
      };
      this.recorder.onerror = () => {
        this.error = "Recording stopped because this browser could not capture audio.";
        this.discarded = true;
        this.stop();
        this.complete();
      };
      this.recorder.onstop = () => this.complete();
      this.recorder.start(1000);
      recording = this;
      for (const output of outputs) this.attach(output);
      // resume() stays within the Record button gesture.
      void this.context.resume().catch(() => {
        this.error = "Audio could not start. Try recording again after playing a note.";
        this.discarded = true;
        this.stop();
      });
      this.timer = setTimeout(() => this.stop(), MAX_TAKE_SECONDS * 1000);
    } catch (error) {
      if (recording === this) recording = null;
      for (const output of [...this.captures.keys()]) this.detach(output);
      if (this.recorder) {
        this.recorder.onstop = null;
        this.recorder.ondataavailable = null;
        this.recorder.onerror = null;
        if (this.recorder.state !== "inactive") this.recorder.stop();
      }
      this.destination?.stream.getTracks().forEach((track) => track.stop());
      try { this.silence?.stop(); } catch { /* Setup did not finish. */ }
      void this.context.close().catch(() => {});
      throw error;
    }
  }

  attach(output: Output): void {
    if (this.finished || this.stopping || this.captures.has(output) || output.context.state === "closed") return;
    let destination: MediaStreamAudioDestinationNode | null = null;
    try {
      destination = output.context.createMediaStreamDestination();
      const source = this.context.createMediaStreamSource(destination.stream);
      output.gain.connect(destination);
      source.connect(this.destination);
      this.captures.set(output, { destination, source });
    } catch {
      destination?.stream.getTracks().forEach((track) => track.stop());
      this.error = "A sound source could not be captured. Try a new recording.";
      this.discarded = true;
      queueMicrotask(() => this.stop());
    }
  }

  detach(output: Output): void {
    const capture = this.captures.get(output);
    if (!capture) return;
    this.captures.delete(output);
    try { output.gain.disconnect(capture.destination); } catch { /* Engine already disconnected. */ }
    capture.source.disconnect();
    capture.destination.stream.getTracks().forEach((track) => track.stop());
  }

  stop(): void {
    if (this.finished || this.stopping) return;
    this.stopping = true;
    if (this.recorder.state !== "inactive") this.recorder.stop();
    else this.complete();
  }

  dispose(): void {
    this.discarded = true;
    this.chunks.length = 0;
    this.stop();
    this.complete();
  }

  private complete(): void {
    if (this.finished) return;
    this.finished = true;
    if (this.timer) clearTimeout(this.timer);
    if (recording === this) recording = null;
    for (const output of [...this.captures.keys()]) this.detach(output);
    this.silence.stop();
    this.silence.disconnect();
    this.destination.stream.getTracks().forEach((track) => track.stop());
    void this.context.close().catch(() => {});
    const blob = !this.discarded && this.chunks.length
      ? new Blob(this.chunks, { type: this.recorder.mimeType || this.chunks[0].type }) : null;
    this.chunks.length = 0;
    this.onComplete(blob, this.error);
  }
}
