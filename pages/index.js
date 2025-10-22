import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, useCallback } from 'react';
import ConnectionPanel from '../components/ConnectionPanel';
import Console from '../components/Console';
import InputBar from '../components/InputBar';
import { createSerialClient } from '../lib/serial/SerialClient';
import { DEFAULT_BAUD, DEFAULT_EOL, EOL_OPTIONS } from '../lib/serial/constants';
import { formatTimestamp } from '../lib/serial/utils';

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

  useEffect(() => {
    const s = { baudRate, eol, timestamps, autoScroll, maxLines };
    try { localStorage.setItem('ws-console-settings', JSON.stringify(s)); } catch {}
  }, [baudRate, eol, timestamps, autoScroll, maxLines]);

  useEffect(() => {
    setLines((prev) => (prev.length > maxLines ? prev.slice(-maxLines) : prev));
  }, [maxLines]);

  useEffect(() => { maxLinesRef.current = maxLines; }, [maxLines]);

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

  const handleSend = useCallback(async (text) => {
    try {
      await clientRef.current.writeLine(text);
    } catch (e) {
      setError(String(e?.message || e));
    }
  }, []);

  const handleClear = useCallback(() => setLines([]), []);

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

  return (
    <div className="page">
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
    </div>
  );
}

export default dynamic(() => Promise.resolve(Home), { ssr: false });
