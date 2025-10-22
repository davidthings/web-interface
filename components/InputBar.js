import { useRef, useState } from 'react';

export default function InputBar({ onSend }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const v = value;
      if (v && v.trim().length) {
        onSend(v);
        setValue('');
      }
    }
  }
  return (
    <div className="inputbar">
      <input
        ref={inputRef}
        className="input input-grow"
        type="text"
        placeholder="Type and press Enter"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
