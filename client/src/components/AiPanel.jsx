import React, { useState, useCallback } from 'react';
import { api } from '../api/client';
import './AiPanel.css';

const TABS = [
  { id: 'review',              icon: '🔍', label: 'Review',        desc: 'Analyze code quality, bugs & best practices' },
  { id: 'explain',             icon: '💡', label: 'Explain',       desc: 'Understand what this code does' },
  { id: 'refactor',            icon: '♻️', label: 'Refactor',      desc: 'Improve structure & readability' },
  { id: 'debug',               icon: '🐛', label: 'Debug',         desc: 'Find & fix errors with stack trace' },
  { id: 'optimize',            icon: '⚡', label: 'Optimize',      desc: 'Improve performance & complexity' },
  { id: 'generate',            icon: '✨', label: 'Generate',      desc: 'Create code from natural language' },
  { id: 'tests',               icon: '🧪', label: 'Tests',         desc: 'Generate unit tests automatically' },
  { id: 'docs',                icon: '📄', label: 'Docs',          desc: 'Generate documentation & comments' },
  { id: 'commit-message',      icon: '📝', label: 'Commit Msg',    desc: 'Generate a Git commit message' },
  { id: 'security',            icon: '🔒', label: 'Security',      desc: 'Scan for vulnerabilities' },
  { id: 'chat',                icon: '💬', label: 'Chat',          desc: 'Ask anything about your code' },
];

const APPLIES_TO_EDITOR = new Set(['refactor', 'generate', 'optimize', 'docs', 'debug']);

/**
 * AI Assistant Panel — slide-in right panel for the Editor.
 *
 * Props:
 *   code        current editor content
 *   language    detected language
 *   filename    active file name
 *   roomId      room UUID (for server-side code fetch)
 *   fileNodeId  file UUID
 *   onInsertCode  (newCode: string) => void  — replace editor content
 *   onClose     () => void
 */
export default function AiPanel({ code, language, filename, roomId, fileNodeId, onInsertCode, onClose }) {
  const [tab, setTab]               = useState('review');
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState('');
  const [error, setError]           = useState('');
  const [copied, setCopied]         = useState(false);

  // Tab-specific inputs
  const [debugError, setDebugError]       = useState('');
  const [generatePrompt, setGenPrompt]    = useState('');
  const [commitChanges, setCommitChanges] = useState('');
  const [chatMessage, setChatMessage]     = useState('');

  const currentTab = TABS.find(t => t.id === tab) || TABS[0];

  const buildPayload = useCallback(() => {
    const base = { code, language, roomId, fileNodeId, filename };
    switch (tab) {
      case 'debug':          return { ...base, error: debugError };
      case 'generate':       return { ...base, prompt: generatePrompt };
      case 'commit-message': return { ...base, changes: commitChanges };
      case 'chat':           return { ...base, message: chatMessage };
      default:               return base;
    }
  }, [tab, code, language, roomId, fileNodeId, filename, debugError, generatePrompt, commitChanges, chatMessage]);

  async function runAi() {
    if (tab === 'chat' && !chatMessage.trim()) return;
    if (tab === 'generate' && !generatePrompt.trim()) return;

    setLoading(true);
    setError('');
    setResult('');
    try {
      const resp = await api.aiCall(tab, buildPayload());
      setResult(resp.result || '');
    } catch (err) {
      setError(err.message || 'AI request failed. Check your GEMINI_API_KEY.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      runAi();
    }
  }

  function copyResult() {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function applyToEditor() {
    if (result && onInsertCode) {
      // Extract code block if present, otherwise use full result
      const codeBlockMatch = result.match(/```(?:\w+)?\n([\s\S]*?)```/);
      const codeToInsert = codeBlockMatch ? codeBlockMatch[1] : result;
      onInsertCode(codeToInsert.trim());
    }
  }

  function switchTab(newTab) {
    setTab(newTab);
    setResult('');
    setError('');
  }

  const hasResult = result.length > 0;
  const canApply = hasResult && APPLIES_TO_EDITOR.has(tab) && onInsertCode;
  const needsCode = !code && !['generate', 'chat'].includes(tab);

  return (
    <div className="ai-panel">
      {/* Header */}
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <span className="ai-panel-icon">🤖</span>
          <span>AI Assistant</span>
        </div>
        <button className="ai-close-btn" onClick={onClose} title="Close AI Panel">✕</button>
      </div>

      {/* Tab bar */}
      <div className="ai-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`ai-tab ${tab === t.id ? 'ai-tab--active' : ''}`}
            onClick={() => switchTab(t.id)}
            title={t.label}
          >
            <span className="ai-tab-icon">{t.icon}</span>
            <span className="ai-tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="ai-panel-body">
        <p className="ai-tab-desc">{currentTab.desc}</p>

        {/* File context pill */}
        {filename && (
          <div className="ai-context-pill">
            <span className="ai-context-icon">📎</span>
            <span>{filename}</span>
            {language && <span className="ai-lang-badge">{language}</span>}
          </div>
        )}

        {needsCode && (
          <div className="ai-warning">
            ⚠️ Open a file in the editor to use this feature.
          </div>
        )}

        {/* Tab-specific inputs */}
        {tab === 'debug' && (
          <div className="ai-input-group">
            <label className="ai-label">Error / Stack Trace (optional)</label>
            <textarea
              className="ai-textarea"
              value={debugError}
              onChange={e => setDebugError(e.target.value)}
              placeholder="Paste the error message or stack trace here..."
              rows={4}
            />
          </div>
        )}

        {tab === 'generate' && (
          <div className="ai-input-group">
            <label className="ai-label">What would you like to generate? <span className="ai-required">*</span></label>
            <textarea
              className="ai-textarea"
              value={generatePrompt}
              onChange={e => setGenPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. A function that sorts a list of users by age and name..."
              rows={4}
            />
            <span className="ai-hint">Ctrl+Enter to run</span>
          </div>
        )}

        {tab === 'commit-message' && (
          <div className="ai-input-group">
            <label className="ai-label">What changed? (optional)</label>
            <textarea
              className="ai-textarea"
              value={commitChanges}
              onChange={e => setCommitChanges(e.target.value)}
              placeholder="e.g. Added user authentication with JWT tokens..."
              rows={3}
            />
          </div>
        )}

        {tab === 'chat' && (
          <div className="ai-input-group">
            <label className="ai-label">Ask anything <span className="ai-required">*</span></label>
            <textarea
              className="ai-textarea"
              value={chatMessage}
              onChange={e => setChatMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Why is this function O(n²)? How can I improve it?"
              rows={4}
            />
            <span className="ai-hint">Ctrl+Enter to send</span>
          </div>
        )}

        {/* Run button */}
        <button
          className="ai-run-btn"
          onClick={runAi}
          disabled={loading || needsCode}
        >
          {loading
            ? <><span className="ai-spinner" /> Thinking...</>
            : <>{currentTab.icon} {currentTab.label}</>
          }
        </button>

        {/* Error */}
        {error && (
          <div className="ai-error">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Result */}
        {hasResult && (
          <div className="ai-result-section">
            <div className="ai-result-header">
              <span className="ai-result-label">Result</span>
              <div className="ai-result-actions">
                {canApply && (
                  <button className="ai-action-btn ai-action-btn--apply" onClick={applyToEditor}>
                    ⬅ Apply to Editor
                  </button>
                )}
                <button className="ai-action-btn" onClick={copyResult}>
                  {copied ? '✅ Copied!' : '📋 Copy'}
                </button>
              </div>
            </div>
            <div className="ai-result">
              <pre className="ai-result-text">{result}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
