import { stopStudioSound } from "./studioEvents";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  canRecordSession, getOutputVolume, MAX_TAKE_SECONDS, SessionRecorder,
  setOutputVolume, subscribeOutputVolume,
} from "./audio/output";
import "./session-audio.css";

function duration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function SessionAudio() {
  const volume = useSyncExternalStore(subscribeOutputVolume, getOutputVolume);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<{ url: string; extension: string } | null>(null);
  const [message, setMessage] = useState("");
  const recorder = useRef<SessionRecorder | null>(null);
  const takeUrl = useRef<string | null>(null);
  const mounted = useRef(true);
  const playback = useRef<HTMLAudioElement | null>(null);
  const supported = canRecordSession();

  useEffect(() => {
    mounted.current = true;
    const hide = () => {
      if (!document.hidden) return;
      recorder.current?.stop();
      playback.current?.pause();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", hide);
      recorder.current?.dispose();
      recorder.current = null;
      playback.current?.pause();
      if (takeUrl.current) URL.revokeObjectURL(takeUrl.current);
      takeUrl.current = null;
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.min(MAX_TAKE_SECONDS, Math.floor((Date.now() - started) / 1000)));
    }, 250);
    return () => clearInterval(timer);
  }, [recording]);

  function startRecording() {
    if (recorder.current) return;
    playback.current?.pause();
    try {
      const next = new SessionRecorder((blob, error) => {
        if (!mounted.current) return;
        recorder.current = null;
        setRecording(false);
        if (error) { setMessage(error); return; }
        if (!blob) { setMessage("No audio was captured. Try another take."); return; }
        if (takeUrl.current) URL.revokeObjectURL(takeUrl.current);
        const url = URL.createObjectURL(blob);
        takeUrl.current = url;
        const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
        setTake({ url, extension });
        setMessage("Take ready. Listen back or download it before switching instruments.");
      });
      recorder.current = next;
      setElapsed(0);
      setRecording(true);
      setMessage("Recording instrument audio. Start playing when ready.");
    } catch {
      setMessage("Recording could not start in this browser. You can continue playing.");
    }
  }

  function deleteTake() {
    playback.current?.pause();
    if (takeUrl.current) URL.revokeObjectURL(takeUrl.current);
    takeUrl.current = null;
    setTake(null);
    setMessage("Take deleted.");
  }

  return <section className="session-audio" aria-label="Session sound and recording">
    <div className="session-audio-controls">
      <label className="session-volume">
        <span>Instrument volume <output>{Math.round(volume * 100)}%</output></span>
        <input type="range" min="0" max="100" step="1" value={Math.round(volume * 100)}
          onChange={(event) => setOutputVolume(Number(event.target.value) / 100)} />
      </label>
      <div className="session-record-controls">
        <button type="button" className="piano-action" onClick={stopStudioSound}>Stop sound <span>Esc</span></button>
        <button type="button" className={`piano-action${recording ? " session-record-live" : ""}`}
          disabled={!supported} onClick={() => recording ? recorder.current?.stop() : startRecording()}>
          <span className="session-record-dot" aria-hidden="true" />{recording ? "Stop recording" : "Record a take"}
        </button>
        <span className="session-record-time">{recording ? `${duration(elapsed)} / 3:00` : "Up to 3 minutes · no microphone"}</span>
      </div>
    </div>
    {take && <div className="session-last-take">
      <span>Last take</span>
      <audio ref={playback} src={take.url} controls preload="metadata" aria-label="Play your last take" />
      <a href={take.url} download={`nerdboard-take.${take.extension}`} className="piano-action">Download</a>
      <button type="button" className="piano-action" disabled={recording} onClick={deleteTake}>Delete</button>
    </div>}
    <p className={`session-audio-note${!message && supported ? " is-empty" : ""}`} role="status">
      {!supported ? "Recording is unavailable in this browser. Instrument volume still works."
        : message}
    </p>
  </section>;
}
