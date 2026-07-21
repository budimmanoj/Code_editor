import React, { useState } from 'react';
import './Modal.css';

const LANGS = ['java', 'javascript', 'python', 'css', 'html', 'typescript', 'go', 'rust', 'cpp'];

const EXT_MAP = {
  'js': 'javascript', 'ts': 'typescript', 'py': 'python',
  'java': 'java', 'css': 'css', 'html': 'html',
  'go': 'go', 'rs': 'rust', 'cpp': 'cpp', 'c': 'cpp', 'h': 'cpp'
};

const LANG_MAP = {
  'javascript': 'js', 'typescript': 'ts', 'python': 'py',
  'java': 'java', 'css': 'css', 'html': 'html',
  'go': 'go', 'rust': 'rs', 'cpp': 'cpp'
};

export default function NewFileModal({ type, onConfirm, onClose }) {
  const [name, setName]     = useState('');
  const [lang, setLang]     = useState('javascript');

  function handleNameChange(val) {
    setName(val);
    if (type === 'FILE') {
      const parts = val.split('.');
      if (parts.length > 1) {
        const ext = parts.pop().toLowerCase();
        if (EXT_MAP[ext]) setLang(EXT_MAP[ext]);
      }
    }
  }

  function submit(e) {
    e.preventDefault();
    let finalName = name.trim();
    if (!finalName) return;
    
    if (type === 'FILE') {
      if (!finalName.includes('.')) {
        const ext = LANG_MAP[lang];
        if (ext) finalName += `.${ext}`;
      }
    }
    
    onConfirm({ name: finalName, type, language: type === 'FILE' ? lang : null });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          {type === 'FILE' ? '+ New File' : '+ New Folder'}
        </div>

        <form onSubmit={submit}>
          <div className="modal-field">
            <label className="label">Name</label>
            <input
              className="input-field"
              placeholder={type === 'FILE' ? 'index.js' : 'src'}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              autoFocus
              required
            />
          </div>

          {type === 'FILE' && (
            <div className="modal-field">
              <label className="label">Language</label>
              <select
                className="input-field"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}
