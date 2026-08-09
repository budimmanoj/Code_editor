import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Copy, ArrowLeftToLine, Paperclip, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import './AiPanel.css';

const MODES = [
  { id: 'chat', label: 'Chat' },
  { id: 'generate', label: 'Generate Code' },
  { id: 'review', label: 'Review Code' },
  { id: 'explain', label: 'Explain Code' },
  { id: 'refactor', label: 'Refactor' },
  { id: 'debug', label: 'Debug' },
  { id: 'optimize', label: 'Optimize' },
  { id: 'tests', label: 'Generate Tests' },
  { id: 'docs', label: 'Generate Docs' },
  { id: 'commit-message', label: 'Commit Message' },
  { id: 'security', label: 'Security Scan' },
];

const APPLIES_TO_EDITOR = new Set(['refactor', 'generate', 'optimize', 'docs', 'debug']);

export default function AiPanel({ code, language, filename, roomId, fileNodeId, onInsertCode, onClose }) {
  const [currentMode, setCurrentMode] = useState('chat');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  const buildPayload = (mode, text) => {
    const base = { code, language, roomId, fileNodeId, filename };
    switch (mode) {
      case 'debug': return { ...base, error: text };
      case 'generate': return { ...base, prompt: text };
      case 'commit-message': return { ...base, changes: text };
      case 'chat': return { ...base, message: text };
      default: return base;
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text && ['chat', 'generate', 'debug', 'commit-message'].includes(currentMode)) {
      return; // Require input for these modes
    }

    const modeObj = MODES.find(m => m.id === currentMode);
    const userMessage = text || `Triggered: ${modeObj.label}`;
    
    // Optimistically add user message
    const newHistory = [...history, { role: 'user', content: userMessage }];
    setHistory(newHistory);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const resp = await api.aiCall(currentMode, buildPayload(currentMode, text));
      setHistory(prev => [...prev, { 
        role: 'ai', 
        content: resp.result || 'No response.', 
        mode: currentMode 
      }]);
    } catch (err) {
      setError(err.message || 'AI request failed.');
      // Remove the optimistic user message if we failed immediately
      setHistory(newHistory.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const applyToEditor = (content) => {
    if (content && onInsertCode) {
      const codeBlockMatch = content.match(/```(?:\w+)?\n([\s\S]*?)```/);
      const codeToInsert = codeBlockMatch ? codeBlockMatch[1] : content;
      onInsertCode(codeToInsert.trim());
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const needsCode = !code && !['generate', 'chat'].includes(currentMode);

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <Bot size={16} />
          <span>AI Assistant</span>
        </div>
        <button className="ai-close-btn" onClick={onClose} title="Close Panel">
          <X size={16} />
        </button>
      </div>

      {filename && (
        <div className="ai-context-pill">
          <Paperclip size={14} />
          <span>{filename}</span>
          {language && <span className="ai-lang-badge">{language}</span>}
        </div>
      )}

      <div className="ai-panel-body">
        {history.length === 0 ? (
          <div style={{ color: 'var(--text2)', fontSize: 13, textAlign: 'center', marginTop: 32 }}>
            <Bot size={32} style={{ opacity: 0.2, marginBottom: 16 }} />
            <p>How can I help with your code today?</p>
          </div>
        ) : (
          history.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.role}`}>
              <div className="chat-bubble">
                {msg.role === 'ai' ? (
                  // Simple pre-wrap formatting for AI response
                  // In a real app, you'd use a Markdown renderer here
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                ) : (
                  msg.content
                )}
              </div>
              
              {msg.role === 'ai' && (
                <div className="chat-actions">
                  <button className="chat-action-btn" onClick={() => copyToClipboard(msg.content)} title="Copy Response">
                    <Copy size={12} /> Copy
                  </button>
                  {APPLIES_TO_EDITOR.has(msg.mode) && onInsertCode && (
                    <button className="chat-action-btn apply" onClick={() => applyToEditor(msg.content)} title="Apply to Editor">
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

      <div className="ai-input-area">
        <select 
          className="ai-mode-select"
          value={currentMode}
          onChange={(e) => setCurrentMode(e.target.value)}
        >
          {MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        
        <div className="ai-input-wrapper">
          <textarea
            className="ai-textarea"
            placeholder={needsCode ? "Open a file first to use this mode" : "Ask anything (Press Enter to send)..."}
            value={input}
            onChange={e => setInput(e.target.value)}
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
