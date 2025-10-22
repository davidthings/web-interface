import StatusBadge from './StatusBadge';
import { EOL_OPTIONS } from '../lib/serial/constants';

export default function ConnectionPanel({ status, error, baudRate, eol, onChangeBaud, onChangeEol, onConnect, onDisconnect, mode }) {
  const canConnect = status === 'disconnected' || status === 'error';
  const canDisconnect = status === 'connected' || status === 'opening' || status === 'requesting';
  return (
    <div className="conn">
      <div className="conn-row">
        <div className="conn-group">
          <label className="label">Baud</label>
          <input className="input" type="number" min="1" step="1" value={baudRate} onChange={e => onChangeBaud(parseInt(e.target.value || '0', 10) || 0)} />
        </div>
        <div className="conn-group">
          <label className="label">EOL</label>
          <select className="select" value={eol} onChange={e => onChangeEol(e.target.value)}>
            {EOL_OPTIONS.map(o => <option key={o.name} value={o.value}>{o.name}</option>)}
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
          <span className="muted">Mode: {mode}</span>
          {error ? <span className="error">{error}</span> : null}
        </div>
      </div>
    </div>
  );
}
