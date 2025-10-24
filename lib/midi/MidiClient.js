import { createEmitter } from '../serial/utils';
import { isWebMIDISupported } from './utils';

export function createMidiClient() {
  const emitter = createEmitter();
  let status = 'disconnected';
  let access = null; // MIDIAccess
  let selectedInputId = '';
  let selectedInput = null; // MIDIInput

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
      const data = ev && ev.data;
      if (!data || !data.length) return;
      const first = data[0];
      if (first === 0xF0) {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        emitter.emit('sysex', bytes);
      }
    } catch (err) {
      try { emitter.emit('error', { where: 'onmidimessage', message: err && err.message, raw: String(err) }); } catch {}
    }
  }

  async function connect() {
    if (!isWebMIDISupported()) {
      setStatus('error');
      throw new Error('WebMIDI not supported in this browser');
    }
    if (status !== 'disconnected' && status !== 'error') return;
    setStatus('requesting');
    try {
      access = await navigator.requestMIDIAccess({ sysex: true });
      if (access) {
        access.onstatechange = () => {
          emitDevices();
          // If current selection disappears, detach
          try {
            const exists = selectedInputId && access.inputs.has(selectedInputId);
            if (!exists) {
              detachInput();
            }
          } catch {}
        };
      }
      emitDevices();
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
          selectedInput.onmidimessage = handleMidiMessage;
        }
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

  function on(type, fn) { return emitter.on(type, fn); }
  function off(type, fn) { return emitter.off(type, fn); }

  return { connect, disconnect, selectInput, getStatus, getSelectedInputId, getDevices, on, off };
}
