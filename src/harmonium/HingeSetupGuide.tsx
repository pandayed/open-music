/** Instructions describe the existing connection flow; they never change permissions. */
export function HingeSetupGuide() {
  return <div className="harmonium-setup-guide">
    <div className="harmonium-setup-intro">
      <strong>Compatible MacBooks use a built-in lid-angle sensor.</strong>
      <p>No external sensor, cable, installation, or macOS switch is needed. You give this website access through your browser’s device chooser.</p>
    </div>
    <div className="harmonium-setup-steps">
      <div className="harmonium-setup-card">
        <h3><span>1</span> Check browser access</h3>
        <ol>
          <li>Open this page in desktop <strong>Chrome or Edge</strong> on a compatible MacBook. Safari and Firefox do not support this connection.</li>
          <li>Use an <strong>HTTPS</strong> address, or <code>http://localhost:5173</code> when running locally. A plain HTTP network address may block access.</li>
          <li><strong>Hinge bellows starts disabled.</strong> That is normal before connecting; it does not mean your MacBook lacks a sensor.</li>
        </ol>
      </div>
      <div className="harmonium-setup-card">
        <h3><span>2</span> Connect and enable</h3>
        <ol>
          <li>Click <strong>Connect lid sensor</strong> at the top of this panel.</li>
          <li>In the browser popup, select <strong>las</strong> if listed, or the Apple lid-angle sensor. Then click the popup’s <strong>Connect</strong> or <strong>Pair</strong> button.</li>
          <li>Once it opens, <strong>Hinge bellows</strong> becomes available and is normally selected automatically. Select it again if you have returned to manual mode.</li>
          <li>Move the lid gently. A changing <strong>Lid angle</strong> below confirms readings are arriving. Hold a note key, such as <strong>A</strong>, and keep moving the lid to supply air.</li>
        </ol>
      </div>
      <div className="harmonium-setup-card">
        <h3><span>3</span> Disable or disconnect</h3>
        <ol>
          <li>Select <strong>Manual pump</strong> or <strong>Steady air</strong> to stop using lid movement for sound. The sensor stays connected for diagnostics.</li>
          <li>Click <strong>Disconnect</strong> to stop this page reading the sensor. Switching instruments also closes the connection.</li>
          <li><strong>Escape / Stop all</strong> stops notes and resets to manual pumping, but keeps the sensor connection available.</li>
          <li>Disconnecting does <strong>not</strong> remove the saved browser permission. See “Remove saved access” below to revoke it.</li>
        </ol>
      </div>
    </div>
    <details className="harmonium-setup-details">
      <summary>Connection not working? Check the message and these cases</summary>
      <table className="harmonium-setup-table">
        <thead><tr><th>What you see</th><th>What to do</th></tr></thead>
        <tbody>
          <tr><td>Hinge bellows is greyed out</td><td>Click <strong>Connect lid sensor</strong> first. Hinge mode unlocks after a successful connection.</td></tr>
          <tr><td>Connect lid sensor is disabled</td><td>Read the status message. If it says the browser or address is unsupported, use Chrome/Edge with HTTPS or localhost. While selecting a sensor or already connected, the button is also disabled.</td></tr>
          <tr><td>The browser blocks the request</td><td>In Chrome, open <strong>Settings → Privacy and security → Site settings → Additional permissions → HID devices</strong>. Check whether sites are allowed to ask for device access and whether this site is blocked. If you choose to allow requests, return here and click Connect again. A setting controlled by your organization requires its administrator.</td></tr>
          <tr><td>The popup lists no sensor</td><td>Cancel the popup. This browser is not offering a matching built-in sensor; that alone does not prove the hardware is absent. Use Manual pump or Steady air, or check macOS’s hardware listing below.</td></tr>
          <tr><td>Connected, but Lid angle stays “—”</td><td>Move the lid gently and watch the reading age. “Connected” means the device opened; it does not guarantee angle reports. Try Disconnect, then Connect again. If no readings arrive, use manual or steady air.</td></tr>
          <tr><td>Angle updates slowly or sound feels delayed</td><td>Check the update rate while moving the lid. Sparse reports can miss movement. Manual pump and Steady air remain available without sensor access.</td></tr>
        </tbody>
      </table>
    </details>
    <details className="harmonium-setup-details">
      <summary>Remove saved access from Chrome</summary>
      <ol>
        <li>Click <strong>Disconnect</strong> here to end the active connection.</li>
        <li>Click the <strong>site information icon to the left of the address</strong> in Chrome.</li>
        <li>Find the connected <strong>HID device / las</strong> entry and click its <strong>Remove</strong> control. This removes this website’s saved device access.</li>
        <li>To check or block future requests, open <strong>Settings → Privacy and security → Site settings → Additional permissions → HID devices</strong>. Reload this page before connecting again if you later want to grant access.</li>
      </ol>
      <p>Browser permissions belong to the website address. Localhost and a deployed website may ask separately. <a href="https://support.google.com/chrome/answer/12576972?hl=en" target="_blank" rel="noreferrer">Chrome’s device-permission instructions ↗</a></p>
    </details>
    <details className="harmonium-setup-details">
      <summary>Optional: check the built-in sensor in macOS Terminal</summary>
      <p>Open <strong>Terminal</strong>, paste this command, and press Enter. It only reads the hardware listing; it does not change settings.</p>
      <pre><code>{`ioreg -r -c IOHIDDevice -l | grep '"Product" = "las"'`}</code></pre>
      <p>A line containing <code>"Product" = "las"</code> means macOS lists a lid-angle sensor under that name. No output means this name was not found; other hardware may use a different name. This check does not grant browser access or prove that angle readings will arrive in the website.</p>
    </details>
  </div>;
}
