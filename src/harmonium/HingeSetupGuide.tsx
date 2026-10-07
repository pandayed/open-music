/** Hardware permission remains controlled by the browser. */
export function HingeSetupGuide() {
  return <div className="harmonium-setup-guide">
    <ul>
      <li><strong>No sensor offered:</strong> cancel the chooser and use Manual pump or Steady air. An empty chooser does not prove the laptop lacks the hardware.</li>
      <li><strong>Connected without movement:</strong> gently move the lid and check whether the angle changes. If nothing changes, disconnect and try again.</li>
      <li><strong>Slow readings:</strong> check the interval while moving. Sensitivity makes reported movement supply more air; it cannot replace missing sensor reports.</li>
      <li><strong>Permission blocked:</strong> check this website’s HID device permissions in the browser’s site settings. An organization-managed setting may require its administrator.</li>
      <li><strong>Stop reading the sensor:</strong> Disconnect closes this session. Switching instruments also closes it. To revoke saved permission, remove this website’s device access through browser site settings.</li>
    </ul>
    <details>
      <summary>Optional macOS hardware check</summary>
      <p>In Terminal, this command reads the hardware listing without changing settings:</p>
      <pre><code>{`ioreg -r -c IOHIDDevice -l | grep '"Product" = "las"'`}</code></pre>
      <p>A matching line means macOS lists a sensor under that name. No output means this name was not found. This check does not grant browser access or verify that angle readings will arrive.</p>
    </details>
    <p>Manual pump and Steady air need no device permission. Use HTTPS or localhost for hinge access. Sensor angles stay in this browser session; only sensitivity and air retention are saved as bellows preferences.</p>
    <p><a href="https://support.google.com/chrome/answer/12576972?hl=en" target="_blank" rel="noreferrer">Chrome device permission help ↗</a></p>
  </div>;
}
