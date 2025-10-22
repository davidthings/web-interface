import { isWebSerialSupported, createEmitter } from './utils';
import { DEFAULT_BAUD, DEFAULT_EOL } from './constants';
import { LineCodec } from './LineCodec';
import { WebSerialTransport } from './WebSerialTransport';
import { MockTransport } from './MockTransport';

export function createSerialClient(opts = {}) {
  const emitter = createEmitter();
  const mode = isWebSerialSupported() ? 'webserial' : 'mock';
  const transport = mode === 'webserial' ? new WebSerialTransport() : new MockTransport();
  let status = 'disconnected';
  let settings = { baudRate: opts.baudRate || DEFAULT_BAUD, eol: opts.eol || DEFAULT_EOL };
  const codec = new LineCodec(settings.eol, (line) => emitter.emit('line', line));

  function setStatus(s) { status = s; emitter.emit('status', status); }

  transport.onData = (t) => codec.write(t);
  if ('onError' in transport) {
    transport.onError = (e) => {
      emitter.emit('error', e);
    };
  }
  if ('onDisconnect' in transport) {
    transport.onDisconnect = () => {
      try { codec.flush(); } catch {}
      setStatus('disconnected');
      emitter.emit('error', 'Device disconnected');
    };
  }

  async function connect(o = {}) {
    if (status !== 'disconnected' && status !== 'error') return;
    settings = { ...settings, ...o };
    setStatus('requesting');
    try {
      await transport.requestPort();
      setStatus('opening');
      await transport.open({ baudRate: settings.baudRate });
      setStatus('connected');
    } catch (err) {
      setStatus('error');
      throw err;
    }
  }

  async function disconnect() {
    if (status === 'disconnected') return;
    setStatus('closing');
    await transport.close();
    try { codec.flush(); } catch {}
    setStatus('disconnected');
  }

  async function write(text) {
    if (status !== 'connected') throw new Error('Not connected');
    await transport.write(text);
  }

  async function writeLine(text) {
    const term = settings.eol || '\n';
    await write(String(text) + term);
  }

  function setSettings(p) {
    settings = { ...settings, ...p };
    if (p.eol) codec.setEol(p.eol);
    emitter.emit('settings', { ...settings });
  }

  function getSettings() { return { ...settings }; }
  function getStatus() { return status; }
  function getMode() { return mode; }
  function on(type, fn) { return emitter.on(type, fn); }
  function off(type, fn) { return emitter.off(type, fn); }

  return { connect, disconnect, write, writeLine, setSettings, getSettings, getStatus, getMode, on, off };
}
