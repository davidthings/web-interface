import { useEffect, useRef } from 'react';
import { formatTimestamp } from '../lib/serial/utils';

export default function Console({ lines, timestamps, autoScroll, maxLines, onChangeMaxLines, onToggleTimestamps, onToggleAutoScroll, onClear, onDownload }) {
  const boxRef = useRef(null);
  useEffect(() => {
    if (!autoScroll || !boxRef.current) return;
    boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines, autoScroll]);
  return (
    <div className="console">
      <div className="console-toolbar">
        <div className="toolbar-left">
          <label className="switch"><input type="checkbox" checked={timestamps} onChange={onToggleTimestamps} /> Timestamps</label>
          <label className="switch"><input type="checkbox" checked={autoScroll} onChange={onToggleAutoScroll} /> Auto-scroll</label>
          <label className="switch">Max lines
            <input
              className="input"
              style={{ width: '100px', marginLeft: '8px' }}
              type="number"
              min="100"
              step="100"
              value={maxLines}
              onChange={(e) => {
                const v = parseInt(e.target.value || '0', 10) || 0;
                const clamped = Math.max(100, Math.min(200000, v));
                onChangeMaxLines(clamped);
              }}
            />
          </label>
        </div>
        <div className="toolbar-right">
          <button className="btn" onClick={onDownload}>Download</button>
          <button className="btn btn-ghost" onClick={onClear}>Clear</button>
        </div>
      </div>
      <div ref={boxRef} className="console-output">
        {lines.map((l, i) => (
          <div key={i} className="console-line">
            {timestamps ? <span className="ts">[{formatTimestamp(l.ts)}] </span> : null}
            <span className="txt">{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
