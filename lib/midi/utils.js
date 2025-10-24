export function isWebMIDISupported() {
  return typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess;
}
