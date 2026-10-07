import { useEffect, useRef } from "react";
import type { HarmoniumController, HarmoniumSnapshot } from "./HarmoniumController";
import { HingeInput } from "./HingeInput";
import { HingeSetupGuide } from "./HingeSetupGuide";

type Props = { open: boolean; onClose: () => void; controller: HarmoniumController; state: HarmoniumSnapshot };

export function hingeStatus(state: HarmoniumSnapshot): string {
  if (state.hinge.kind !== "connected") return state.hinge.message;
  if (!state.reading) return "Sensor connected. Move the lid gently to check its readings.";
  if (!state.movementDetected) return "Readings received. Move the lid gently to verify movement.";
  if ((state.readingAgeMs ?? 0) > 1500) return "Movement detected earlier. Move the lid to check current responsiveness.";
  const rate = state.reading.readingsPerSecond;
  if (rate !== null && rate < 10) return "Movement detected; readings are arriving slowly. Manual pump and Steady air offer a more consistent response.";
  return "Movement detected. Your lid movement can now supply air.";
}

export function HingeSetupDialog({ open, onClose, controller, state }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    else if (!open && dialog?.open) dialog.close();
  }, [open]);
  function close() {
    controller.cancelCalibration();
    // An outstanding browser chooser cannot be dismissed here, but its result
    // must not reopen the sensor after the player has cancelled setup.
    if (state.hinge.kind === "connecting") controller.disconnectHinge();
    onClose();
  }
  const unavailable = HingeInput.availability();
  const connected = state.hinge.kind === "connected";
  const connecting = state.hinge.kind === "connecting";
  const calibration = state.calibration;
  return <dialog ref={ref} className="hinge-setup-dialog" aria-labelledby="hinge-setup-title"
    onCancel={(event) => { event.preventDefault(); close(); }} onClose={onClose}>
    <div className="hinge-dialog-heading"><div><span className="synth-kicker">HARMONIUM SETUP</span><h2 id="hinge-setup-title">Play with your lid</h2></div>
      <button type="button" className="piano-action" onClick={close} aria-label="Close hinge setup" autoFocus>Close ×</button></div>
    <p className="hinge-intro">A compatible built-in lid sensor lets gentle opening and closing supply air. Manual pump and Steady air work on every supported instrument screen.</p>
    <ol className="hinge-setup-flow">
      <li><h3>Check browser access</h3><p>{unavailable ?? "This browser can request a sensor on this address. Hardware availability is checked when you connect."}</p>
        <p className="hinge-muted">Chrome and Edge expose WebHID on supported desktops. Safari and Firefox do not currently support this connection. Not every laptop has the matching Apple lid-angle sensor.</p></li>
      <li><h3>Connect your sensor</h3><p>Your browser opens its own permission chooser. Select <strong>las</strong> or the Apple lid-angle sensor if offered, then confirm access.</p>
        <div className="hinge-inline-actions"><button type="button" className="piano-action" disabled={Boolean(unavailable) || connecting || connected} onClick={controller.connectHinge}>{connecting ? "Waiting for browser…" : connected ? "Sensor connected" : "Connect lid sensor"}</button>
          {(connected || connecting) && <button type="button" className="piano-action" onClick={controller.disconnectHinge}>{connecting ? "Cancel connection" : "Disconnect"}</button>}</div>
        <p className="hinge-live-status" role="status">{hingeStatus(state)}</p></li>
      {connected && <li><h3>Calibrate gentle movement</h3><p>Move your lid through a few comfortable strokes for 8 seconds. Calibration uses actual changing angles to adjust bellows sensitivity.</p>
        <div className="hinge-inline-actions"><button type="button" className="piano-action" disabled={!connected || calibration.kind === "running"} onClick={() => controller.beginCalibration()}>{calibration.kind === "running" ? "Move the lid gently…" : "Calibrate sensitivity"}</button>
          {calibration.kind === "running" && <button type="button" className="piano-action" onClick={() => controller.cancelCalibration()}>Cancel calibration</button>}</div>
        {calibration.kind === "running" && <progress aria-label="Calibration progress" value={calibration.progress} max={1} />}
        <p role="status">{calibration.kind === "complete" ? `Sensitivity adjusted to ${state.sensitivity.toFixed(1)}×. Try a note and adjust it below if needed.`
          : calibration.kind === "insufficient" ? "Too little changing movement was received. Sensitivity was kept. Try again, or use Manual pump or Steady air."
            : calibration.kind === "running" ? `${calibration.travel.toFixed(0)}° of movement received.` : "Calibration is optional. Start with 3× sensitivity and adjust by feel."}</p>
        <label className="hinge-setting">Bellows sensitivity <output>{state.sensitivity.toFixed(1)}×</output>
          <input type="range" min="0.5" max="6" step="0.1" value={state.sensitivity} disabled={calibration.kind === "running"} onChange={(event) => controller.setSensitivity(Number(event.target.value))} /></label>
      </li>}
    </ol>
    <details className="hinge-diagnostics"><summary>Sensor readings and connection help</summary>
      <dl className="harmonium-diagnostics">
        <div><dt>Lid angle</dt><dd>{state.reading ? `${state.reading.angle.toFixed(0)}°` : "—"}</dd></div>
        <div><dt>Last interval</dt><dd>{state.reading?.intervalMs != null ? `${Math.round(state.reading.intervalMs)} ms` : "—"}</dd></div>
        <div><dt>Update rate</dt><dd>{state.reading?.readingsPerSecond != null ? `${state.reading.readingsPerSecond.toFixed(1)} Hz` : "—"}</dd></div>
        <div><dt>Last reading</dt><dd>{state.readingAgeMs !== null ? `${(state.readingAgeMs / 1000).toFixed(1)} s ago` : "—"}</dd></div>
      </dl><HingeSetupGuide /></details>
    <div className="hinge-dialog-footer"><div className="hinge-inline-actions"><button type="button" className="piano-action" onClick={() => { controller.setMode("manual"); close(); }}>Use Manual pump</button><button type="button" className="piano-action" onClick={() => { controller.setMode("steady"); close(); }}>Use Steady air</button></div>
      <button type="button" className="piano-action" disabled={!connected || !state.movementDetected} onClick={() => { controller.setMode("hinge"); close(); }}>Play with hinge</button></div>
  </dialog>;
}
