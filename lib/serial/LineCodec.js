export class LineCodec {
  constructor(eol, onLine) {
    this.eol = eol || '\n';
    this.onLine = onLine;
    this.buffer = '';
  }
  setEol(eol) { this.eol = eol || '\n'; }
  write(chunk) {
    if (!chunk) return;
    this.buffer += chunk;
    const parts = this.buffer.split(/\r\n|\n|\r/);
    this.buffer = parts.pop();
    for (const line of parts) this.onLine(line);
  }
  flush() {
    if (this.buffer) {
      this.onLine(this.buffer);
      this.buffer = '';
    }
  }
}
