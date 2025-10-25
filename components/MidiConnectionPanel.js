import StatusBadge from './StatusBadge';

export default function MidiConnectionPanel({ status, error, inputs, selectedInputId, onSelectInput, onConnect, onDisconnect, onStartStreaming, onStopStreaming }) {
  const hasInputs = Array.isArray(inputs) && inputs.length > 0;
  const onlyThrough = hasInputs && inputs.length === 1 && ((inputs[0].name || '')).toLowerCase().includes('midi through');
  const hasSelection = !!(selectedInputId && inputs && inputs.some(inp => inp.id === selectedInputId));
  const displayStatus = status === 'connected'
    ? (!hasInputs ? 'no-devices' : (onlyThrough ? 'no-physical' : (!hasSelection ? 'no-input' : 'connected')))
    : status;
  const canConnect = status === 'disconnected' || status === 'error';
  const canDisconnect = status === 'connected' || status === 'requesting' || status === 'closing';
  const canStream = status === 'connected' && hasInputs && hasSelection;
  return (
    <div className="conn">
      <div className="conn-row">
        <div className="conn-group" style={{ minWidth: '280px' }}>
          <label className="label">MIDI Input</label>
          <select className="select" value={selectedInputId} onChange={e => onSelectInput(e.target.value)}>
            <option value="">(none)</option>
            {inputs.map(inp => (
              <option key={inp.id} value={inp.id}>{inp.name}{inp.manufacturer ? ` — ${inp.manufacturer}` : ''}</option>
            ))}
          </select>
        </div>
        <div className="conn-group">
          <label className="label">Status</label>
          <StatusBadge status={displayStatus} />
        </div>
        <div className="conn-actions">
          <button className="btn" onClick={onConnect} disabled={!canConnect}>Connect</button>
          <button className="btn btn-ghost" onClick={onDisconnect} disabled={!canDisconnect}>Disconnect</button>
          <span style={{ width: '16px' }} />
          <button className="btn" onClick={onStartStreaming} disabled={!canStream}>Start Streaming</button>
          <button className="btn btn-ghost" onClick={onStopStreaming} disabled={!canStream}>Stop Streaming</button>
        </div>
      </div>
      <div className="conn-row">
        <div className="conn-status">
          <span className="muted">Mode: webmidi</span>
          {status === 'connected' && !hasInputs ? <span className="error">No MIDI inputs detected</span> : null}
          {status === 'connected' && hasInputs && onlyThrough ? <span className="error">No physical MIDI device detected (only MIDI Through present)</span> : null}
          {status === 'connected' && hasInputs && !onlyThrough && !hasSelection ? <span className="muted">No input selected</span> : null}
          {error ? <span className="error">{error}</span> : null}
        </div>
      </div>
    </div>
  );
}
