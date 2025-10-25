export default function StatusBadge({ status }) {
  const map = {
    disconnected: ['#f87171', 'Disconnected'],
    requesting: ['#fbbf24', 'Requesting'],
    opening: ['#fbbf24', 'Opening'],
    connected: ['#34d399', 'Connected'],
    closing: ['#60a5fa', 'Closing'],
    error: ['#f87171', 'Error'],
    'no-devices': ['#f87171', 'No Devices'],
    'no-physical': ['#fbbf24', 'No Physical Device'],
    'no-input': ['#fbbf24', 'No Input Selected']
  };
  const [color, label] = map[status] || ['#9ca3af', String(status || '')];
  return (
    <span className="status-badge">
      <span className="dot" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </span>
  );
}
