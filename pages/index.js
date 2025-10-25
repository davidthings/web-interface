import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, useCallback } from 'react';
import ConnectionPanel from '../components/ConnectionPanel';
import Console from '../components/Console';
import InputBar from '../components/InputBar';
import MidiConnectionPanel from '../components/MidiConnectionPanel';
import { createSerialClient } from '../lib/serial/SerialClient';
import { DEFAULT_BAUD, DEFAULT_EOL, EOL_OPTIONS } from '../lib/serial/constants';
import { formatTimestamp } from '../lib/serial/utils';
import { createMidiClient } from '../lib/midi/MidiClient';

function Home() {
  const clientRef = useRef(null);
  const [status, setStatus] = useState('disconnected');
  const [mode, setMode] = useState('webserial');
  const [error, setError] = useState('');
  const [baudRate, setBaudRate] = useState(DEFAULT_BAUD);
  const [eol, setEol] = useState(DEFAULT_EOL);
  const [timestamps, setTimestamps] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lines, setLines] = useState([]);
  const [maxLines, setMaxLines] = useState(2000);
  const maxLinesRef = useRef(2000);

  // MIDI state
  const midiClientRef = useRef(null);
  const [midiStatus, setMidiStatus] = useState('disconnected');
  const [midiError, setMidiError] = useState('');
  const [midiInputs, setMidiInputs] = useState([]);
  const [midiSelectedInputId, setMidiSelectedInputId] = useState('');
  const [midiTimestamps, setMidiTimestamps] = useState(true);
  const [midiAutoScroll, setMidiAutoScroll] = useState(true);
  const [midiLines, setMidiLines] = useState([]);
  const [midiMaxLines, setMidiMaxLines] = useState(2000);
  const midiMaxLinesRef = useRef(2000);

  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('ws-console-settings') || '{}') : {};
      if (saved.baudRate) setBaudRate(saved.baudRate);
      if (saved.eol) setEol(saved.eol);
      if (typeof saved.timestamps === 'boolean') setTimestamps(saved.timestamps);
      if (typeof saved.autoScroll === 'boolean') setAutoScroll(saved.autoScroll);
      if (saved.maxLines) { setMaxLines(saved.maxLines); maxLinesRef.current = saved.maxLines; }
    } catch {}
  }, []);

  // Load MIDI console settings
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('wm-console-settings') || '{}') : {};
      if (typeof saved.timestamps === 'boolean') setMidiTimestamps(saved.timestamps);
      if (typeof saved.autoScroll === 'boolean') setMidiAutoScroll(saved.autoScroll);
      if (saved.maxLines) { setMidiMaxLines(saved.maxLines); midiMaxLinesRef.current = saved.maxLines; }
      if (saved.selectedInputId) setMidiSelectedInputId(saved.selectedInputId);
    } catch {}
  }, []);

  useEffect(() => {
    const s = { baudRate, eol, timestamps, autoScroll, maxLines };
    try { localStorage.setItem('ws-console-settings', JSON.stringify(s)); } catch {}
  }, [baudRate, eol, timestamps, autoScroll, maxLines]);

  // Persist MIDI console settings
  useEffect(() => {
    const s = { timestamps: midiTimestamps, autoScroll: midiAutoScroll, maxLines: midiMaxLines, selectedInputId: midiSelectedInputId };
    try { localStorage.setItem('wm-console-settings', JSON.stringify(s)); } catch {}
  }, [midiTimestamps, midiAutoScroll, midiMaxLines, midiSelectedInputId]);

  useEffect(() => {
    setLines((prev) => (prev.length > maxLines ? prev.slice(-maxLines) : prev));
  }, [maxLines]);

  useEffect(() => {
    setMidiLines((prev) => (prev.length > midiMaxLines ? prev.slice(-midiMaxLines) : prev));
  }, [midiMaxLines]);

  useEffect(() => { maxLinesRef.current = maxLines; }, [maxLines]);
  useEffect(() => { midiMaxLinesRef.current = midiMaxLines; }, [midiMaxLines]);

  useEffect(() => {
    const c = createSerialClient({ baudRate, eol });
    clientRef.current = c;
    setMode(c.getMode());
    const offStatus = c.on('status', (v) => {
      setStatus(v);
      setLines((prev) => {
        const entry = { ts: Date.now(), text: `status: ${v}`, kind: 'status' };
        const cap = maxLinesRef.current;
        const next = prev.length >= cap ? [...prev.slice(-(cap - 1)), entry] : [...prev, entry];
        return next;
      });
    });
    const offError = c.on('error', (msg) => {
      let m;
      if (msg && typeof msg === 'object') {
        try { m = JSON.stringify(msg, null, 2); } catch { m = String(msg); }
      } else {
        m = String(msg || '');
      }
      setError(m);
      setLines((prev) => {
        const entry = { ts: Date.now(), text: m, kind: 'error' };
        const cap = maxLinesRef.current;
        const next = prev.length >= cap ? [...prev.slice(-(cap - 1)), entry] : [...prev, entry];
        return next;
      });
    });
    const offLine = c.on('line', (text) => {
      setLines((prev) => {
        const entry = { ts: Date.now(), text, kind: 'data' };
        const cap = maxLinesRef.current;
        const next = prev.length >= cap ? [...prev.slice(-(cap - 1)), entry] : [...prev, entry];
        return next;
      });
    });
    return () => {
      offStatus();
      offError();
      offLine();
      c.disconnect();
    };
  }, []);

  // Setup MIDI client and listeners (init once)
  useEffect(() => {
    const c = createMidiClient();
    midiClientRef.current = c;
    const offStatus = c.on('status', (v) => setMidiStatus(v));
    const offError = c.on('error', (msg) => setMidiError(typeof msg === 'string' ? msg : (msg && msg.message) || String(msg || '')));
    const offDevices = c.on('devices', ({ inputs }) => {
      setMidiInputs(Array.isArray(inputs) ? inputs : []);
    });
    const offSysex = c.on('sysex', (bytes) => {
      try {
        const text = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        setMidiLines((prev) => {
          const entry = { ts: Date.now(), text, kind: 'sysex' };
          const cap = midiMaxLinesRef.current;
          const next = prev.length >= cap ? [...prev.slice(-(cap - 1)), entry] : [...prev, entry];
          return next;
        });
      } catch (e) {
        try { setMidiError(String(e?.message || e)); } catch {}
      }
    });
    const offTx = c.on('tx', ({ hex }) => {
      try {
        const text = `TX ${hex}`;
        setMidiLines((prev) => {
          const entry = { ts: Date.now(), text, kind: 'tx' };
          const cap = midiMaxLinesRef.current;
          const next = prev.length >= cap ? [...prev.slice(-(cap - 1)), entry] : [...prev, entry];
          return next;
        });
      } catch (e) {
        try { setMidiError(String(e?.message || e)); } catch {}
      }
    });
    return () => {
      offStatus();
      offError();
      offDevices();
      offSysex();
      offTx();
      try { c.disconnect(); } catch {}
    };
  }, []);

  // Apply MIDI input selection changes when state or device list updates
  useEffect(() => {
    try { if (midiClientRef.current) midiClientRef.current.selectInput(midiSelectedInputId); } catch {}
  }, [midiSelectedInputId, midiInputs]);

  const handleConnect = useCallback(async () => {
    setError('');
    try {
      await clientRef.current.connect({ baudRate });
    } catch (e) {
      setError(String(e?.message || e));
    }
  }, [baudRate]);

  const handleDisconnect = useCallback(async () => {
    setError('');
    try { await clientRef.current.disconnect(); } catch (e) { setError(String(e?.message || e)); }
  }, []);

  // MIDI actions
  const handleMidiConnect = useCallback(async () => {
    setMidiError('');
    try { await midiClientRef.current.connect(); } catch (e) { setMidiError(String(e?.message || e)); }
  }, []);

  const handleMidiDisconnect = useCallback(async () => {
    setMidiError('');
    try { await midiClientRef.current.disconnect(); } catch (e) { setMidiError(String(e?.message || e)); }
  }, []);

  const handleMidiSelectInput = useCallback((id) => {
    setMidiSelectedInputId(id);
    try { midiClientRef.current.selectInput(id); } catch (e) { setMidiError(String(e?.message || e)); }
  }, []);

  const handleMidiStartStreaming = useCallback(() => {
    setMidiError('');
    try { midiClientRef.current.startStreaming(); } catch (e) { setMidiError(String(e?.message || e)); }
  }, []);

  const handleMidiStopStreaming = useCallback(() => {
    setMidiError('');
    try { midiClientRef.current.stopStreaming(); } catch (e) { setMidiError(String(e?.message || e)); }
  }, []);

  const handleSend = useCallback(async (text) => {
    try {
      await clientRef.current.writeLine(text);
    } catch (e) {
      setError(String(e?.message || e));
    }
  }, []);

  const handleClear = useCallback(() => setLines([]), []);

  const handleMidiClear = useCallback(() => setMidiLines([]), []);

  const handleDownload = useCallback(() => {
    const header = `mode=${mode}, baud=${baudRate}, eol=${EOL_OPTIONS.find(o => o.value === eol)?.name || ''}`;
    const content = lines.map(l => (timestamps ? `[${formatTimestamp(l.ts)}] ` : '') + l.text).join('\n');
    const blob = new Blob([header + '\n' + content + '\n'], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'webserial-console.log';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  }, [lines, timestamps, mode, baudRate, eol]);

  const handleMidiDownload = useCallback(() => {
    const header = 'mode=webmidi, content=sysex-hex';
    const content = midiLines.map(l => (midiTimestamps ? `[${formatTimestamp(l.ts)}] ` : '') + l.text).join('\n');
    const blob = new Blob([header + '\n' + content + '\n'], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'webmidi-sysex.log';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  }, [midiLines, midiTimestamps]);

  return (
    <div className="page">
      {/* WebMIDI Section */}
      <section>
        <header className="panel">
          <MidiConnectionPanel
            status={midiStatus}
            error={midiError}
            inputs={midiInputs}
            selectedInputId={midiSelectedInputId}
            onSelectInput={handleMidiSelectInput}
            onConnect={handleMidiConnect}
            onDisconnect={handleMidiDisconnect}
            onStartStreaming={handleMidiStartStreaming}
            onStopStreaming={handleMidiStopStreaming}
          />
        </header>
        <main className="main">
          <Console
            lines={midiLines}
            timestamps={midiTimestamps}
            autoScroll={midiAutoScroll}
            maxLines={midiMaxLines}
            onChangeMaxLines={(v) => setMidiMaxLines(v)}
            onToggleTimestamps={() => setMidiTimestamps(v => !v)}
            onToggleAutoScroll={() => setMidiAutoScroll(v => !v)}
            onClear={handleMidiClear}
            onDownload={handleMidiDownload}
          />
        </main>
      </section>

      {/* WebSerial Section (unchanged behavior) */}
      <section>
        <header className="panel">
          <ConnectionPanel
            status={status}
            mode={mode}
            error={error}
            baudRate={baudRate}
            eol={eol}
            onChangeBaud={(v) => setBaudRate(v)}
            onChangeEol={(v) => { setEol(v); if (clientRef.current) clientRef.current.setSettings({ eol: v }); }}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </header>
        <main className="main">
          <Console
            lines={lines}
            timestamps={timestamps}
            autoScroll={autoScroll}
            maxLines={maxLines}
            onChangeMaxLines={(v) => setMaxLines(v)}
            onToggleTimestamps={() => setTimestamps(v => !v)}
            onToggleAutoScroll={() => setAutoScroll(v => !v)}
            onClear={handleClear}
            onDownload={handleDownload}
          />
        </main>
        <footer className="footer">
          <InputBar onSend={handleSend} />
        </footer>
      </section>
    </div>
  );
}

export default dynamic(() => Promise.resolve(Home), { ssr: false });
