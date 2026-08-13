import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, X, Send, Copy, ArrowLeftToLine, Paperclip, AlertCircle,
  FilePlus, FileEdit, Check, XCircle, Loader, FolderOpen, Globe, MessageSquarePlus
} from 'lucide-react';
import { api } from '../api/client';
import './AiPanel.css';

const MODES = [
  { id: 'chat',           label: 'Chat',              workspace: true  },
  { id: 'generate',       label: 'Generate Code',     workspace: false },
  { id: 'review',         label: 'Review Code',       workspace: false },
  { id: 'explain',        label: 'Explain Code',      workspace: false },
  { id: 'refactor',       label: 'Refactor',          workspace: false },
  { id: 'debug',          label: 'Debug',             workspace: false },
  { id: 'optimize',       label: 'Optimize',          workspace: false },
  { id: 'tests',          label: 'Generate Tests',    workspace: false },
  { id: 'docs',           label: 'Generate Docs',     workspace: false },
  { id: 'commit-message', label: 'Commit Message',    workspace: false },
  { id: 'security',       label: 'Security Scan',     workspace: false },
];

const APPLIES_TO_EDITOR = new Set(['refactor', 'generate', 'optimize', 'docs', 'debug']);

// ── Helper: flatten FileTreeDto into a compact list ──────────────────────────
function flattenTree(node, path = '', result = []) {
  if (!node) return result;
  const currentPath = path ? `${path}/${node.name}` : node.name;
  if (node.name !== '__root__') {
    result.push({
      id: node.id,
      name: node.name,
      type: node.fileType || 'FILE',
      language: node.language || '',
      path: currentPath,
    });
  }
  if (node.children) {
    node.children.forEach(child => flattenTree(child, node.name === '__root__' ? '' : currentPath, result));
  }
  return result;
}

// ── CREATE_FILE action card ───────────────────────────────────────────────────
function CreateFileCard({ action, roomId, onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handle = async () => {
    setLoading(true);
    try {
      const result = await api.aiWorkspaceAction(action, roomId);
      setDone(true);
      onConfirm(result);
    } catch (e) {
      alert('Failed to create file: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-action-card ai-action-create">
      <div className="ai-action-header">
        <FilePlus size={15} className="ai-action-icon" />
        <span className="ai-action-title">Create File</span>
        <span className="ai-action-filename">{action.fileName}</span>
        {action.language && <span className="ai-lang-badge">{action.language}</span>}
      </div>
      {action.content && (
        <pre className="ai-action-preview" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {action.content}
        </pre>
      )}
      {!done ? (
        <div className="ai-action-buttons">
          <button className="ai-action-btn ai-action-confirm" onClick={handle} disabled={loading}>
            {loading ? <Loader size={13} className="spin" /> : <Check size={13} />}
            {loading ? 'Creating...' : 'Create File'}
          </button>
          <button className="ai-action-btn ai-action-cancel" onClick={onCancel} disabled={loading}>
            <XCircle size={13} /> Cancel
          </button>
        </div>
      ) : (
        <div className="ai-action-success">✅ {action.fileName} created!</div>
      )}
    </div>
  );
}

// ── UPDATE_FILE action card ───────────────────────────────────────────────────
function UpdateFileCard({ action, currentCode, roomId, onConfirm, onCancel, onInsertCode }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const newContent = action.newContent || '';

  const handle = async () => {
    setLoading(true);
    try {
      const result = await api.aiWorkspaceAction(action, roomId);
      setDone(true);
      onConfirm(result, newContent);
    } catch (e) {
      alert('Failed to update file: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-action-card ai-action-update">
      <div className="ai-action-header">
        <FileEdit size={15} className="ai-action-icon" />
        <span className="ai-action-title">Proposed Changes</span>
        <span className="ai-action-filename">{action.fileNameForDisplay || 'current file'}</span>
      </div>

      <button
        className="ai-diff-toggle"
        onClick={() => setShowDiff(v => !v)}
      >
        {showDiff ? '▲ Hide diff' : '▼ View proposed code'}
      </button>

      {showDiff && (
        <pre className="ai-action-preview ai-diff-view" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {newContent}
        </pre>
      )}

      {!done ? (
        <div className="ai-action-buttons">
          <button className="ai-action-btn ai-action-confirm" onClick={handle} disabled={loading}>
            {loading ? <Loader size={13} className="spin" /> : <Check size={13} />}
            {loading ? 'Applying...' : 'Apply Changes'}
          </button>
          {onInsertCode && (
            <button
              className="ai-action-btn"
              style={{ background: 'var(--bg2)', color: 'var(--text1)' }}
              onClick={() => onInsertCode(newContent)}
              disabled={loading}
            >
              <ArrowLeftToLine size={13} /> Apply to Editor Only
            </button>
          )}
          <button className="ai-action-btn ai-action-cancel" onClick={onCancel} disabled={loading}>
            <XCircle size={13} /> Reject
          </button>
        </div>
      ) : (
        <div className="ai-action-success">✅ Changes applied & version saved!</div>
      )}
    </div>
  );
}

// ── Context level pill ────────────────────────────────────────────────────────
function ContextPill({ filename, language, mentionedFiles }) {
  if (!filename && (!mentionedFiles || mentionedFiles.length === 0)) return null;
  return (
    <div className="ai-context-bar">
      {filename && (
        <span className="ai-context-pill">
          <Paperclip size={11} /> {filename}
          {language && <span className="ai-lang-badge">{language}</span>}
        </span>
      )}
      {mentionedFiles && mentionedFiles.map(f => (
        <span key={f.id} className="ai-context-pill ai-mention-pill">
          <FolderOpen size={11} /> {f.name}
        </span>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AiPanel({
  code, language, filename, roomId, fileNodeId, activeFileVersion,
  tree,                     // FileTreeDto from EditorPage
  onInsertCode, onClose,
  onFileCreated,            // callback(fileId, fileName) after AI creates a file
  onCodeUpdated,            // callback(fileId, newContent) after AI updates a file
}) {
  const [currentMode, setCurrentMode] = useState('chat');
  const [input, setInput]     = useState('');
  const [history, setHistory] = useState(() => {
    try {
      const stored = sessionStorage.getItem(`cr_ai_history_${roomId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (history.length > 0) {
      sessionStorage.setItem(`cr_ai_history_${roomId}`, JSON.stringify(history));
    } else {
      sessionStorage.removeItem(`cr_ai_history_${roomId}`);
    }
  }, [history, roomId]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [mentionedFiles, setMentionedFiles] = useState([]); // files explicitly referenced via @file
  const [showFileMenu, setShowFileMenu]     = useState(false);
  const [fileMenuQuery, setFileMenuQuery]   = useState('');
  const messagesEndRef = useRef(null);

  // Flattened workspace files for @file autocomplete
  const allFiles = tree ? flattenTree(tree).filter(f => f.type === 'FILE' || f.type === 'FOLDER') : [];
  const fileMatches = allFiles.filter(f =>
    f.name.toLowerCase().includes(fileMenuQuery.toLowerCase()) ||
    (f.path || '').toLowerCase().includes(fileMenuQuery.toLowerCase())
  ).slice(0, 12);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  // ── Build payload ──────────────────────────────────────────────────────────
  const buildPayload = useCallback((mode, text) => {
    // Compact workspace tree — names + types only, no content
    const workspaceTree = tree ? flattenTree(tree) : [];

    const base = {
      code,             // live editor state for active file
      language,
      roomId,
      fileNodeId,
      filename,
      activeFileName: filename,
      workspaceTree,
    };

    // Attach any explicitly referenced additional files
    if (mentionedFiles.length > 0) {
      base.additionalFiles = mentionedFiles;
    }

    // Send recent conversation history for workspace chat (bounded to last 10 messages)
    const boundedHistory = history.slice(-10).map(h => {
      let cleanedContent = h.content;
      if (!cleanedContent && h.action) {
        // Strip large code payloads from history to save tokens
        const actionSummary = { ...h.action };
        delete actionSummary.content;
        delete actionSummary.newContent;
        cleanedContent = JSON.stringify(actionSummary);
      } else if (!cleanedContent && h.actions) {
        const actionsSummary = h.actions.map(a => {
          const sum = { ...a };
          delete sum.content;
          delete sum.newContent;
          return sum;
        });
        cleanedContent = JSON.stringify(actionsSummary);
      }
      return {
        role: h.role,
        content: cleanedContent || ''
      };
    });

    switch (mode) {
      case 'debug':          return { ...base, error: text };
      case 'generate':       return { ...base, prompt: text };
      case 'commit-message': return { ...base, changes: text };
      case 'chat':           return { ...base, message: text, history: boundedHistory };
      default:               return base;
    }
  }, [code, language, roomId, fileNodeId, filename, tree, mentionedFiles, history]);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text && ['chat', 'generate', 'debug', 'commit-message'].includes(currentMode)) return;

    const modeObj = MODES.find(m => m.id === currentMode);
    const userMessage = text || `Triggered: ${modeObj.label}`;

    const newHistory = [...history, { role: 'user', content: userMessage }];
    setHistory(newHistory);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const resp = await api.aiCall(currentMode, buildPayload(currentMode, text));

      if ((resp.responseType === 'ACTION' || resp.responseType === 'ACTIONS') && (resp.action || resp.actions)) {
        const aiActions = resp.actions || (resp.action ? [resp.action] : []);
        setHistory(prev => [...prev, {
          role: 'ai',
          content: null,
          actions: aiActions,
          mode: currentMode,
        }]);
      } else {
        setHistory(prev => [...prev, {
          role: 'ai',
          content: resp.result || 'No response.',
          mode: currentMode,
        }]);
      }
    } catch (err) {
      setError(err.message || 'AI request failed.');
      setHistory(newHistory.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  // ── Input change with @mention parsing ────────────────────────────────────
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);

    // Detect @workspace
    if (val.match(/@workspace\s*$/i)) {
      setInput(val.replace(/@workspace\s*$/i, ''));
      // Mark workspace-level context (we already send the tree — just add a note)
      return;
    }

    // Detect @file <query>
    const fileMatch = val.match(/@file\s+(\S*)$/i);
    if (fileMatch) {
      setFileMenuQuery(fileMatch[1]);
      setShowFileMenu(true);
      setShowModeMenu(false);
      return;
    }

    // Detect @mode trigger
    const modeMatch = val.match(/@(\w*)$/);
    if (modeMatch) {
      setShowModeMenu(true);
      setShowFileMenu(false);
    } else {
      setShowModeMenu(false);
      setShowFileMenu(false);
    }
  };

  const selectMode = (modeId) => {
    setCurrentMode(modeId);
    setInput(input.replace(/@\w*$/, ''));
    setShowModeMenu(false);
  };

  // Add a file to the mentioned files list — fetch its content
  const addMentionedFile = async (file) => {
    setShowFileMenu(false);
    setInput(input.replace(/@file\s+\S*$/i, `@${file.name} `));

    if (mentionedFiles.find(f => f.id === file.id)) return;

    try {
      const content = await api.getFile(roomId, file.id);
      setMentionedFiles(prev => [...prev, {
        id: file.id,
        name: file.name,
        language: file.language || '',
        content: typeof content === 'string' ? content : '',
      }]);
    } catch {
      // If fetch fails, include without content
      setMentionedFiles(prev => [...prev, { id: file.id, name: file.name, language: file.language || '', content: '' }]);
    }
  };

  const removeMention = (id) => {
    setMentionedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleKeyDown = (e) => {
    if (showModeMenu || showFileMenu) {
      if (e.key === 'Escape') { setShowModeMenu(false); setShowFileMenu(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const applyToEditor = (content) => {
    if (content && onInsertCode) {
      const match = content.match(/```(?:\w+)?\n([\s\S]*?)```/);
      onInsertCode((match ? match[1] : content).trim());
    }
  };

  const copyToClipboard = (text) => navigator.clipboard.writeText(text);

  const needsCode = !code && !['generate', 'chat'].includes(currentMode);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="ai-panel">
      {/* Header */}
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <Bot size={16} />
          <span>AI Assistant</span>
          {currentMode === 'chat' && (
            <span className="ai-workspace-badge">
              <Globe size={10} /> workspace
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="ai-close-btn" onClick={() => setHistory([])} title="New Chat">
            <MessageSquarePlus size={16} />
          </button>
          <button className="ai-close-btn" onClick={onClose} title="Close Panel">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Context pills */}
      <ContextPill filename={filename} language={language} mentionedFiles={mentionedFiles} />

      {/* Mentioned file chips with remove */}
      {mentionedFiles.length > 0 && (
        <div className="ai-mentions-bar">
          {mentionedFiles.map(f => (
            <span key={f.id} className="ai-mention-chip">
              {f.name}
              <button onClick={() => removeMention(f.id)}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Chat body */}
      <div className="ai-panel-body">
        {history.length === 0 ? (
          <div className="ai-empty-state">
            <Bot size={32} style={{ opacity: 0.2, marginBottom: 16 }} />
            <p>I know your workspace. Ask anything about your code.</p>
            <div className="ai-tips">
              <span>💡 Try: <em>"What does this file do?"</em></span>
              <span>💡 Try: <em>"Create a sum.cpp file"</em></span>
              <span>💡 Try: <em>"Add error handling to this file"</em></span>
              <span>💡 Type <code>@file</code> to reference another file</span>
            </div>
          </div>
        ) : (
          history.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.role}`}>
              {msg.role === 'ai' && msg.actions && msg.actions.length > 0 ? (
                /* Action cards */
                <div className="ai-actions-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {msg.actions.map((act, actIdx) => (
                    act.type === 'CREATE_FILE' ? (
                      <CreateFileCard
                        key={`act-${idx}-${actIdx}`}
                        action={act}
                        roomId={roomId}
                        onConfirm={(result) => {
                          if (onFileCreated) onFileCreated(result.fileId, result.fileName);
                        }}
                        onCancel={() => {}}
                      />
                    ) : act.type === 'UPDATE_FILE' ? (
                      <UpdateFileCard
                        key={`act-${idx}-${actIdx}`}
                        action={{ ...act, expectedVersion: activeFileVersion }}
                        currentCode={code}
                        roomId={roomId}
                        onConfirm={(result, newContent) => {
                          if (onCodeUpdated) onCodeUpdated(act.fileId, newContent);
                        }}
                        onCancel={() => {
                          // Note: this removes the whole message (all actions) which might not be ideal
                          // if there are multiple actions, but for now we keep the same behavior
                          setHistory(prev => prev.filter((_, i) => i !== idx));
                        }}
                        onInsertCode={onInsertCode}
                      />
                    ) : (
                      <div key={`act-${idx}-${actIdx}`} className="chat-bubble">
                        <pre style={{ whiteSpace: 'pre-wrap' }}>Unknown action: {act.type}</pre>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                /* Normal text message */
                <div className="chat-bubble">
                  {msg.role === 'ai' ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  ) : msg.content}
                </div>
              )}

              {msg.role === 'ai' && msg.content && (
                <div className="chat-actions">
                  <button className="chat-action-btn" onClick={() => copyToClipboard(msg.content)} title="Copy">
                    <Copy size={12} /> Copy
                  </button>
                  {APPLIES_TO_EDITOR.has(msg.mode) && onInsertCode && (
                    <button className="chat-action-btn apply" onClick={() => applyToEditor(msg.content)}>
                      <ArrowLeftToLine size={12} /> Apply
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="ai-loading">
            <span className="ai-spinner" /> AI is thinking...
          </div>
        )}

        {error && (
          <div className="ai-error">
            <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="ai-input-area" style={{ position: 'relative' }}>

        {/* @mode dropdown */}
        {showModeMenu && (
          <div className="ai-mention-dropdown">
            {MODES.filter(m =>
              m.id.includes((input.match(/@(\w*)$/) || [])[1]?.toLowerCase() || '') ||
              m.label.toLowerCase().includes((input.match(/@(\w*)$/) || [])[1]?.toLowerCase() || '')
            ).map(m => (
              <div key={m.id} className="ai-mention-item" onClick={() => selectMode(m.id)}>
                <span className="ai-mention-tag">@{m.id}</span>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* @file dropdown */}
        {showFileMenu && (
          <div className="ai-mention-dropdown">
            {fileMatches.length === 0 ? (
              <div className="ai-mention-item" style={{ color: 'var(--text2)', cursor: 'default' }}>
                No files found
              </div>
            ) : fileMatches.map(f => (
              <div key={f.id} className="ai-mention-item" onClick={() => addMentionedFile(f)}>
                <span className="ai-mention-tag">{f.type === 'FILE' ? '📄' : '📁'}</span>
                <span>{f.path || f.name}</span>
                {f.language && <span className="ai-lang-badge">{f.language}</span>}
              </div>
            ))}
          </div>
        )}

        <select
          className="ai-mode-select"
          value={currentMode}
          onChange={(e) => setCurrentMode(e.target.value)}
          style={{ position: 'relative', zIndex: 2 }}
        >
          {MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>

        <div className="ai-input-wrapper">
          <textarea
            className="ai-textarea"
            placeholder={
              needsCode
                ? 'Open a file first to use this mode'
                : 'Ask anything… @file to reference a file, @workspace for the whole project'
            }
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={needsCode || loading}
          />
          <button
            className="ai-send-btn"
            onClick={handleSend}
            disabled={needsCode || loading || (!input.trim() && ['chat', 'generate', 'debug', 'commit-message'].includes(currentMode))}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
