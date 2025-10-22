export class WebSerialTransport {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.onData = null;
    this.onDisconnect = null;
    this.onError = null;
    this._textDecoder = null;
    this._textEncoder = null;
    this._reading = false;
    this._disconnectHandler = null;
    this._navDisconnectHandler = null;
    this._readLoopPromise = null;
    this._closing = false;
  }
  async requestPort() {
    this.port = await navigator.serial.requestPort();
    return !!this.port;
  }
  async open({ baudRate }) {
    if (!this.port) throw new Error('No port');
    await this.port.open({ baudRate });
    this._textDecoder = new TextDecoder();
    this._textEncoder = new TextEncoder();
    if (this.port.readable) this.reader = this.port.readable.getReader();
    if (this.port.writable) this.writer = this.port.writable.getWriter();
    this._reading = true;
    this._navDisconnectHandler = (e) => {
      try {
        if (e && e.port && this.port && e.port === this.port) {
          this._reading = false;
          if (typeof this.onError === 'function') {
            try {
              this.onError({ where: 'nav-disconnect', lost: true, message: 'navigator.serial disconnect event', raw: String(e && e.type) });
            } catch {}
          }
          if (typeof this.onDisconnect === 'function') {
            try { this.onDisconnect(); } catch {}
          }
        }
      } catch {}
    };
    navigator.serial.addEventListener('disconnect', this._navDisconnectHandler);
    this._readLoopPromise = (async () => {
      try {
        while (this._reading) {
          const { value, done } = await this.reader.read();
          if (done) {
            // If we initiated close(), don't treat as error.
            if (!this._closing) {
              if (typeof this.onError === 'function') {
                try { this.onError({ where: 'read', lost: true, message: 'readable stream ended (done=true)' }); } catch {}
              }
              if (typeof this.onDisconnect === 'function') {
                try { this.onDisconnect(); } catch {}
              }
            }
            break;
          }
          if (value && value.length) {
            const str = this._textDecoder.decode(value, { stream: true });
            if (str && this.onData) this.onData(str);
          }
        }
      } catch (err) {
        if (!this._closing) {
          if (typeof this.onError === 'function') {
            try { this.onError({ where: 'read', lost: true, name: err && err.name, message: err && err.message, stack: err && err.stack, raw: String(err) }); } catch {}
          }
          if (typeof this.onDisconnect === 'function') {
            try { this.onDisconnect(); } catch {}
          }
        }
      } finally {
        try { if (this.reader) this.reader.releaseLock(); } catch {}
        this.reader = null;
        // Flush decoder
        try {
          const rest = this._textDecoder && this._textDecoder.decode();
          if (rest && this.onData) this.onData(rest);
        } catch {}
      }
    })();
  }
  async write(text) {
    if (!this.writer) throw new Error('Not connected');
    const chunk = this._textEncoder.encode(text);
    await this.writer.write(chunk);
  }
  async close() {
    this._closing = true;
    this._reading = false;
    try { if (this.reader) await this.reader.cancel(); } catch {}
    try { if (this.reader) this.reader.releaseLock(); } catch {}
    try { if (this.writer) await this.writer.close(); } catch {}
    try { if (this.writer) this.writer.releaseLock(); } catch {}
    try { if (this._readLoopPromise) await this._readLoopPromise; } catch {}
    try { if (this.port) await this.port.close(); } catch {}
    if (this._navDisconnectHandler) {
      try { navigator.serial.removeEventListener('disconnect', this._navDisconnectHandler); } catch {}
    }
    this.reader = null;
    this.writer = null;
    this.port = null;
    this._textDecoder = null;
    this._textEncoder = null;
    this._readLoopPromise = null;
    this._closing = false;
  }
}
