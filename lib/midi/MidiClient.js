import { createEmitter } from '../serial/utils';
import { isWebMIDISupported } from './utils';

export function createMidiClient() {
  const emitter = createEmitter();
  let status = 'disconnected';
  let access = null; // MIDIAccess
  let selectedInputId = '';
  let selectedInput = null; // MIDIInput
  let selectedOutput = null; // MIDIOutput (auto-selected)
  
  const VENDOR = [0x00, 0x01, 0x5F, 0x7A];
  const PID = 0x42;
  const GROUP = 0x01;
  const TYPE_TETHER = 16;

  function setStatus(s) { status = s; emitter.emit('status', status); }

  function emitDevices() {
    try {
      const inputs = [];
      const outputs = [];
      if (access) {
        try { for (const input of access.inputs.values()) inputs.push({ id: input.id, name: input.name || input.id, manufacturer: input.manufacturer || '' }); } catch {}
        try { for (const output of access.outputs.values()) outputs.push({ id: output.id, name: output.name || output.id, manufacturer: output.manufacturer || '' }); } catch {}
      }
      emitter.emit('devices', { inputs, outputs });
    } catch {}
  }

  function detachInput() {
    try {
      if (selectedInput) selectedInput.onmidimessage = null;
    } catch {}
    selectedInput = null;
  }

  function handleMidiMessage(ev) {
    try {
      const bytes = ev && ev.data ? (ev.data instanceof Uint8Array ? ev.data : new Uint8Array(ev.data)) : null;
      if (!bytes || !bytes.length) return;
      const s = bytes[0];
      const hi = s & 0xF0;
      const chan = (s & 0x0F) + 1;
      let kind = 'system';
      if (hi === 0x80) kind = 'note-off';
      else if (hi === 0x90) kind = bytes[2] ? 'note-on' : 'note-off';
      else if (hi === 0xA0) kind = 'poly-aftertouch';
      else if (hi === 0xB0) kind = 'control-change';
      else if (hi === 0xC0) kind = 'program-change';
      else if (hi === 0xD0) kind = 'channel-aftertouch';
      else if (hi === 0xE0) kind = 'pitch-bend';
      try { console.log('[MIDI] rx', { kind, chan, len: bytes.length, hex: Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ') }); } catch {}
      if (bytes[0] === 0xF0) {
        emitter.emit('sysex', bytes);
      }
    } catch (err) {
      try { emitter.emit('error', { where: 'onmidimessage', message: err && err.message, raw: String(err) }); } catch {}
    }
  }

  async function connect() {
    try { console.log('[MIDI] connect start', { supported: isWebMIDISupported(), secure: typeof window !== 'undefined' && window.isSecureContext }); } catch {}
    if (!isWebMIDISupported()) {
      setStatus('error');
      throw new Error('WebMIDI not supported in this browser');
    }
    if (status !== 'disconnected' && status !== 'error') return;
    setStatus('requesting');
    try {
      try {
        if (navigator && navigator.permissions && navigator.permissions.query) {
          navigator.permissions.query({ name: 'midi', sysex: true }).then((p) => { try { console.log('[MIDI] permission', p && p.state); } catch {} }).catch(() => {});
        }
      } catch {}
      access = await navigator.requestMIDIAccess({ sysex: true });
      if (access) {
        try {
          console.log('[MIDI] access', {
            sysexEnabled: access && access.sysexEnabled,
            inputs: (() => { const arr = []; try { for (const i of access.inputs.values()) arr.push({ id: i.id, name: i.name || i.id, man: i.manufacturer || '', state: i.state, connection: i.connection }); } catch {} return arr; })(),
            outputs: (() => { const arr = []; try { for (const o of access.outputs.values()) arr.push({ id: o.id, name: o.name || o.id, man: o.manufacturer || '', state: o.state, connection: o.connection }); } catch {} return arr; })()
          });
        } catch {}
        access.onstatechange = (e) => {
          emitDevices();
          try { console.log('[MIDI] statechange', { type: e && e.port && e.port.type, id: e && e.port && e.port.id, name: e && e.port && e.port.name, state: e && e.port && e.port.state, connection: e && e.port && e.port.connection }); } catch {}
          try {
            const exists = selectedInputId && access.inputs.has(selectedInputId);
            if (!exists) {
              detachInput();
            }
            try {
              if (access && access.outputs) {
                let picked = null;
                for (const o of access.outputs.values()) { picked = o; break; }
                selectedOutput = picked;
                if (selectedOutput) {
                  try { console.log('[MIDI] tx output selected', { id: selectedOutput.id, name: selectedOutput.name || selectedOutput.id }); } catch {}
                }
              }
            } catch {}
          } catch {}
        };
      }
      emitDevices();
      try {
        const ic = (() => { let n = 0; try { n = access && access.inputs ? access.inputs.size : 0; } catch {} return n; })();
        const oc = (() => { let n = 0; try { n = access && access.outputs ? access.outputs.size : 0; } catch {} return n; })();
        console.log('[MIDI] device counts', { inputs: ic, outputs: oc });
      } catch {}
      setStatus('connected');
    } catch (err) {
      setStatus('error');
      throw err;
    }
  }

  async function disconnect() {
    if (status === 'disconnected') return;
    setStatus('closing');
    try {
      detachInput();
      if (access) {
        try { access.onstatechange = null; } catch {}
      }
      access = null;
    } finally {
      setStatus('disconnected');
    }
  }

  function selectInput(id) {
    selectedInputId = id || '';
    detachInput();
    try {
      if (access && id && access.inputs.has(id)) {
        selectedInput = access.inputs.get(id);
        if (selectedInput) {
          try { console.log('[MIDI] listening', { id: selectedInput.id, name: selectedInput.name || selectedInput.id, man: selectedInput.manufacturer || '' }); } catch {}
          selectedInput.onmidimessage = handleMidiMessage;
          try {
            if (access && access.outputs) {
              let match = null;
              const targetName = (selectedInput.name || '').toLowerCase();
              for (const o of access.outputs.values()) {
                const nm = (o.name || '').toLowerCase();
                if (nm && targetName && nm === targetName) { match = o; break; }
              }
              if (!match) { for (const o of access.outputs.values()) { match = o; break; } }
              selectedOutput = match;
              if (selectedOutput) {
                try { console.log('[MIDI] tx output selected', { id: selectedOutput.id, name: selectedOutput.name || selectedOutput.id }); } catch {}
              }
            }
          } catch {}
        }
      } else {
        try { console.log('[MIDI] input not found', id); } catch {}
      }
    } catch (err) {
      try { emitter.emit('error', { where: 'selectInput', message: err && err.message, raw: String(err) }); } catch {}
    }
  }

  function getStatus() { return status; }
  function getSelectedInputId() { return selectedInputId; }
  function getDevices() {
    const inputs = [];
    const outputs = [];
    try {
      if (access) {
        for (const input of access.inputs.values()) inputs.push({ id: input.id, name: input.name || input.id, manufacturer: input.manufacturer || '' });
        for (const output of access.outputs.values()) outputs.push({ id: output.id, name: output.name || output.id, manufacturer: output.manufacturer || '' });
      }
    } catch {}
    return { inputs, outputs };
  }

  function getOutput() {
    try {
      if (selectedOutput && access && access.outputs && access.outputs.has(selectedOutput.id)) return selectedOutput;
    } catch {}
    try {
      if (access && access.outputs && access.outputs.size) {
        for (const o of access.outputs.values()) { selectedOutput = o; break; }
        return selectedOutput;
      }
    } catch {}
    return null;
  }

  function toHex(bytes) {
    try { return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '); } catch { return ''; }
  }

  function sendBytes(bytes, kind = 'raw') {
    try {
      const out = getOutput();
      if (!out) { throw new Error('No MIDI output available'); }
      out.send(bytes);
      try { console.log('[MIDI] tx', { kind, len: bytes.length, hex: toHex(bytes) }); } catch {}
      try { emitter.emit('tx', { kind, bytes, hex: toHex(bytes) }); } catch {}
    } catch (err) {
      try { emitter.emit('error', { where: 'sendBytes', message: err && err.message, raw: String(err) }); } catch {}
      throw err;
    }
  }

  function sendCC(controller, value, channel = 1) {
    const ch = Math.min(16, Math.max(1, channel));
    const status = 0xB0 + (ch - 1);
    const data = [status, controller & 0x7F, value & 0x7F];
    sendBytes(data, 'cc');
  }

  function buildSysex(type, payload = []) {
    const len = (payload ? payload.length : 0);
    const body = [0xF0, ...VENDOR, PID & 0x7F, GROUP & 0x7F, len & 0x7F, type & 0x7F, ...(payload || []), 0xF7];
    return body;
  }

  function sendSysex(type, payload = []) {
    const msg = buildSysex(type, payload);
    sendBytes(msg, 'sysex');
  }

  function startStreaming() { sendSysex(TYPE_TETHER, [1]); }
  function stopStreaming() { sendSysex(TYPE_TETHER, [0]); }

  function on(type, fn) { return emitter.on(type, fn); }
  function off(type, fn) { return emitter.off(type, fn); }

  return {
    connect,
    disconnect,
    selectInput,
    getStatus,
    getSelectedInputId,
    getDevices,
    sendCC,
    sendSysex,
    startStreaming,
    stopStreaming,
    on,
    off,
  };
}
