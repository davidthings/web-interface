export class MockTransport {
  constructor() {
    this.onData = null;
    this._timer = null;
    this._open = false;
  }
  async requestPort() {
    return true;
  }
  async open({ baudRate }) {
    this._open = true;
    let n = 0;
    this._timer = setInterval(() => {
      if (!this._open) return;
      if (this.onData) this.onData(`mock ${++n}`);
    }, 1000);
  }
  async write(text) {
    if (this.onData) this.onData(text);
  }
  async close() {
    this._open = false;
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }
}
