import { useState } from "react";
import Guitar from "./Guitar";
import Piano from "./piano/Piano";
import Drums from "./drums/Drums";
import type { Instrument } from "./InstrumentSwitcher";

export default function App() {
  const [instrument, setInstrument] = useState<Instrument>("guitar");
  // Unmounting disposes the previous controller, its listeners, and its audio.
  if (instrument === "guitar") return <Guitar onSelectInstrument={setInstrument} />;
  if (instrument === "piano") return <Piano onSelectInstrument={setInstrument} />;
  return <Drums onSelectInstrument={setInstrument} />;
}
