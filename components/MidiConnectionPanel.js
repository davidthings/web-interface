import StatusBadge from './StatusBadge';

export default function MidiConnectionPanel({ status, error, inputs, selectedInputId, onSelectInput, onConnect, onDisconnect }) {
  const canConnect = status === 'disconnected' || status === 'error';
  const canDisconnect = status === 'connected' || status === 'requesting' || status === 'closing';
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
          <StatusBadge status={status} />
        </div>
        <div className="conn-actions">
          <button className="btn" onClick={onConnect} disabled={!canConnect}>Connect</button>
          <button className="btn btn-ghost" onClick={onDisconnect} disabled={!canDisconnect}>Disconnect</button>
        </div>
      </div>
      <div className="conn-row">
        <div className="conn-status">
          <span className="muted">Mode: webmidi</span>
          {error ? <span className="error">{error}</span> : null}
        </div>
      </div>
    </div>
  );
}
