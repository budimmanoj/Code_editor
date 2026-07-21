import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, tokenStore } from '../api/client';
import { RoomSocket } from '../websocket/RoomSocket';
import FileTree from '../components/FileTree';
import CodeEditor from '../components/CodeEditor';
import Participants from '../components/Participants';
import NewFileModal from '../components/NewFileModal';
import AiPanel from '../components/AiPanel';
import './EditorPage.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function langFromExt(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const MAP = {
    js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    py: 'python', java: 'java', go: 'go', rs: 'rust',
    c: 'c', cpp: 'cpp', h: 'c', cs: 'csharp',
    rb: 'ruby', php: 'php', swift: 'swift', kt: 'kotlin',
    html: 'html', css: 'css', scss: 'css',
    json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', sh: 'shell', bash: 'shell',
    sql: 'sql', r: 'r', scala: 'scala',
  };
  return MAP[ext] || ext || 'plaintext';
}

function isBinaryFile(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const BINARY = new Set([
    'png','jpg','jpeg','gif','webp','ico','svg','bmp','tiff',
    'pdf','doc','docx','xls','xlsx','ppt','pptx',
    'zip','tar','gz','rar','7z','bz2',
    'exe','dll','so','dylib','bin','class','jar','war',
    'mp3','mp4','mov','avi','mkv','wav','flac',
    'ttf','otf','woff','woff2','eot','db','sqlite','lock',
  ]);
  return BINARY.has(ext);
}

function sanitizeText(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x00/g, '');
}

function flattenTree(node, prefix = '') {
  const results = [];
  const myPath = prefix ? `${prefix}/${node.name}` : node.name;
  if (node.fileType === 'FILE') results.push({ path: myPath, node });
  if (node.children) for (const child of node.children) results.push(...flattenTree(child, myPath));
  return results;
}

function downloadText(filename, content) {
  const blob = new Blob([content || ''], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditorPage({ user, roomId, roomName, userRole, onLeave }) {
  // Core state
  const [tree,         setTree]         = useState(null);
  const [participants, setParticipants] = useState([]);
  const [activeFile,   setActiveFile]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(`cr_file_${roomId}`)); } catch { return null; }
  });
  const [code,         setCode]         = useState(() => {
    try {
      const file = JSON.parse(sessionStorage.getItem(`cr_file_${roomId}`));
      if (file) return sessionStorage.getItem(`cr_code_${roomId}_${file.id}`) || '';
    } catch { /* ignore */ }
    return '';
  });
  const [savedCode,    setSavedCode]    = useState('');
  const [saving,       setSaving]       = useState(false);
  const [saveMsg,      setSaveMsg]      = useState('');
  const [versions,     setVersions]     = useState([]);
  const [modal,        setModal]        = useState(null);
  const [sideTab,      setSideTab]      = useState('files');
  const [error,        setError]        = useState('');
  const [inviteCode,   setInviteCode]   = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [viewCodeVersion, setViewCodeVersion] = useState(null);
  const [downloadMsg,  setDownloadMsg]  = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // WebSocket / Collaboration state
  const [wsConnected,  setWsConnected]  = useState(false);
  const [onlineUsers,  setOnlineUsers]  = useState(new Map()); // userId → {userId, username, color}
  const [typingUsers,  setTypingUsers]  = useState(new Map()); // userId → {username, color}
  const [toasts,       setToasts]       = useState([]);

  // AI Panel state
  const [showAiPanel,  setShowAiPanel]  = useState(false);
  const [reviewResult, setReviewResult] = useState('');
  const [reviewLoading,setReviewLoading]= useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Refs
  const socketRef        = useRef(null);
  const activeFileRef    = useRef(activeFile);
  const lastRemoteCode   = useRef('');    // track last content received via WS
  const wsUpdateTimer    = useRef(null);  // debounced WS send timer
  const typingTimer      = useRef(null);  // typing indicator timer
  const isResizing       = useRef(false);
  const fileInputRef     = useRef(null);
  const folderInputRef   = useRef(null);

  const isAdmin = userRole === 'ADMIN';
  const isDirty = code !== savedCode;

  // Keep activeFileRef in sync
  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);

  // ── Toast helper ───────────────────────────────────────────────────────────

  function addToast(message, type = 'info') {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  // ── WebSocket setup ────────────────────────────────────────────────────────

  useEffect(() => {
    const socket = new RoomSocket(roomId, tokenStore.get());
    socketRef.current = socket;

    socket.on('connected',    () => setWsConnected(true));
    socket.on('disconnected', () => setWsConnected(false));

    socket.on('PRESENCE_INIT', (msg) => {
      const map = new Map();
      (msg.participants || []).forEach(p => map.set(p.userId, p));
      setOnlineUsers(map);
    });

    socket.on('USER_JOINED', (msg) => {
      setOnlineUsers(prev => new Map(prev).set(msg.userId, msg));
      addToast(`${msg.username} joined`, 'join');
    });

    socket.on('USER_LEFT', (msg) => {
      setOnlineUsers(prev => { const m = new Map(prev); m.delete(msg.userId); return m; });
      addToast(`${msg.username} left`, 'leave');
    });

    socket.on('CODE_UPDATE', (msg) => {
      // Only update if this message is for the currently open file
      if (!activeFileRef.current || activeFileRef.current.id !== msg.fileId) return;
      // Ignore echoes of our own edits (server doesn't echo, but extra safety)
      if (msg.userId === String(user.id)) return;
      // Track remote content to avoid echo loop
      lastRemoteCode.current = msg.content;
      setCode(msg.content);
    });

    socket.on('TYPING', (msg) => {
      setTypingUsers(prev => {
        const m = new Map(prev);
        if (msg.typing) m.set(msg.userId, { username: msg.username, color: msg.color });
        else m.delete(msg.userId);
        return m;
      });
    });

    socket.connect();
    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ── Data loaders ───────────────────────────────────────────────────────────

  const loadTree = useCallback(async () => {
    try { setTree(await api.getFileTree(roomId)); } catch { setTree(null); }
  }, [roomId]);

  const loadParticipants = useCallback(async () => {
    try {
      const data = await api.getRoomParticipants(roomId);
      setParticipants(data.participants || []);
      if (data.inviteCode) setInviteCode(data.inviteCode);
    } catch { /* ignore */ }
  }, [roomId]);

  const loadVersions = useCallback(async (fileId) => {
    try { setVersions(await api.getFileVersions(roomId, fileId)); }
    catch { setVersions([]); }
  }, [roomId]);

  // Admin invite code
  useEffect(() => {
    if (isAdmin) {
      api.getMyProfile().then(profile => {
        const r = (profile.roomsCreated || []).find(r => r.id === roomId);
        if (r) setInviteCode(r.inviteCode);
      }).catch(() => {});
    }
  }, [isAdmin, roomId]);

  // Initial load (no polling — WS handles real-time)
  useEffect(() => {
    loadTree();
    loadParticipants();
    if (activeFile) {
      loadVersions(activeFile.id);
      api.getFile(roomId, activeFile.id).then(content => {
        setSavedCode(content || '');
        const draft = sessionStorage.getItem(`cr_code_${roomId}_${activeFile.id}`);
        if (!draft || draft === content) { setCode(content || ''); setSaveMsg(''); }
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Session persistence
  useEffect(() => {
    if (activeFile) sessionStorage.setItem(`cr_file_${roomId}`, JSON.stringify(activeFile));
    else            sessionStorage.removeItem(`cr_file_${roomId}`);
  }, [activeFile, roomId]);

  useEffect(() => {
    if (code && activeFile) sessionStorage.setItem(`cr_code_${roomId}_${activeFile.id}`, code);
    else if (activeFile)    sessionStorage.removeItem(`cr_code_${roomId}_${activeFile.id}`);
  }, [code, roomId, activeFile]);

  // ── File selection ─────────────────────────────────────────────────────────

  async function selectFile(node) {
    if (node.fileType === 'FOLDER') return;
    const draft = sessionStorage.getItem(`cr_code_${roomId}_${node.id}`);
    setActiveFile(node);
    lastRemoteCode.current = '';
    if (draft) { setCode(draft); setSaveMsg('unsaved'); }
    else       { setCode(''); setSaveMsg(''); }
    try {
      const content = await api.getFile(roomId, node.id);
      if (draft && draft !== content) { setCode(draft); setSaveMsg('unsaved'); }
      else { setCode(content || ''); }
      setSavedCode(content || '');
      lastRemoteCode.current = content || '';
      loadVersions(node.id);
    } catch { setCode(''); setSavedCode(''); }
  }

  // ── Code editing & saving ──────────────────────────────────────────────────

  function handleCodeChange(val) {
    setCode(val);
    if (!activeFile) return;
    setSaveMsg('unsaved');

    // Don't echo remote updates back over WS
    if (val === lastRemoteCode.current) return;

    // Debounced WS broadcast (500ms)
    if (wsUpdateTimer.current) clearTimeout(wsUpdateTimer.current);
    wsUpdateTimer.current = setTimeout(() => {
      socketRef.current?.sendCodeUpdate(activeFileRef.current?.id, val);
    }, 500);

    // Typing indicator
    socketRef.current?.sendTyping(activeFileRef.current?.id, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.sendTyping(activeFileRef.current?.id, false);
    }, 2000);
  }

  // Autosave: 1.5s after last keystroke
  useEffect(() => {
    if (activeFile && code !== savedCode) {
      const timer = setTimeout(saveCode, 1500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, activeFile, savedCode]);

  async function saveCode() {
    if (!activeFile) return;
    setSaving(true);
    try {
      await api.updateCode({ roomId, fileNodeId: activeFile.id, content: code });
      setSavedCode(code);
      setSaveMsg('saved');
      setTimeout(() => setSaveMsg(''), 2000);
      loadVersions(activeFile.id);
    } catch (e) { setSaveMsg('error'); setError('Save failed: ' + e.message); }
    finally { setSaving(false); }
  }

  // AI Review before saving — opens modal with review, then saves
  async function reviewAndSave() {
    if (!activeFile) return;
    setShowReviewModal(true);
    setReviewLoading(true);
    setReviewResult('');
    try {
      const resp = await api.aiCall('review-before-commit', {
        code, language: activeFile.language,
        filename: activeFile.name,
        roomId, fileNodeId: activeFile.id,
      });
      setReviewResult(resp.result);
    } catch (e) {
      setReviewResult('⚠️ AI review unavailable: ' + e.message + '\n\nYou can still save normally.');
    } finally {
      setReviewLoading(false);
    }
  }

  // ── Versions ───────────────────────────────────────────────────────────────

  async function revertToVersion(versionId) {
    if (!activeFile) return;
    try {
      const newCode = await api.revertToVersion(roomId, activeFile.id, versionId);
      setCode(newCode); setSavedCode(newCode); setSaveMsg('saved');
      lastRemoteCode.current = newCode;
      socketRef.current?.sendCodeUpdate(activeFile.id, newCode);
      setTimeout(() => setSaveMsg(''), 2000);
      loadVersions(activeFile.id);
    } catch (e) { setError('Failed to revert: ' + e.message); }
  }

  async function reviewVersion(versionId, status) {
    try {
      await api.updateVersionStatus(roomId, versionId, status);
      loadVersions(activeFile.id);
      const content = await api.getFile(roomId, activeFile.id);
      setCode(content || ''); setSavedCode(content || '');
      lastRemoteCode.current = content || '';
    } catch (e) { setError('Failed to update status: ' + e.message); }
  }

  // ── Create / Delete / Rename ───────────────────────────────────────────────

  async function handleCreate({ name, type, language }) {
    try {
      await api.createFileNode({ roomId, parentId: modal.parentId, name, type, language });
      setModal(null);
      await loadTree();
    } catch (e) { setError(e.message); setModal(null); }
  }

  function requestDelete(id, name, isFolder) { setDeleteConfirm({ id, name, isFolder }); }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    try {
      await api.deleteFileNode(roomId, deleteConfirm.id);
      if (activeFile?.id === deleteConfirm.id) {
        setActiveFile(null); setCode(''); setSavedCode(''); setVersions([]);
      }
      await loadTree();
    } catch (e) { setError('Delete failed: ' + e.message); }
    finally { setDeleteConfirm(null); }
  }

  async function handleRename(nodeId, newName) {
    try {
      await api.renameFileNode(roomId, nodeId, newName);
      if (activeFile?.id === nodeId) setActiveFile(prev => ({ ...prev, name: newName }));
      await loadTree();
    } catch (e) { setError('Rename failed: ' + e.message); }
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSaving(true); setError('');
    const skipped = [];
    try {
      for (const file of files) {
        if (isBinaryFile(file.name)) { skipped.push(file.name); continue; }
        const content = sanitizeText(await file.text());
        const language = langFromExt(file.name);
        const created = await api.createFileNode({ roomId, parentId: null, name: file.name, type: 'FILE', language });
        await api.updateCode({ roomId, fileNodeId: created.id, content });
      }
      if (skipped.length) setError(`Skipped binary files: ${skipped.join(', ')}`);
      await loadTree();
    } catch (err) { setError('Upload failed: ' + err.message); }
    finally { setSaving(false); e.target.value = ''; }
  }

  async function handleFolderUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSaving(true); setError('');
    const skipped = [];
    try {
      const dirMap = { '': null };
      for (const file of files) {
        if (isBinaryFile(file.name)) { skipped.push(file.webkitRelativePath); continue; }
        const parts = file.webkitRelativePath.split('/');
        let currentPath = '', currentParentId = null;
        for (let i = 0; i < parts.length - 1; i++) {
          const dirName = parts[i];
          const newPath = currentPath ? `${currentPath}/${dirName}` : dirName;
          if (!(newPath in dirMap)) {
            const created = await api.createFileNode({ roomId, parentId: currentParentId, name: dirName, type: 'FOLDER' });
            dirMap[newPath] = created.id;
          }
          currentParentId = dirMap[newPath];
          currentPath = newPath;
        }
        const fileName = parts[parts.length - 1];
        if (!fileName) continue;
        const content = sanitizeText(await file.text());
        const language = langFromExt(fileName);
        const created = await api.createFileNode({ roomId, parentId: currentParentId, name: fileName, type: 'FILE', language });
        await api.updateCode({ roomId, fileNodeId: created.id, content });
      }
      if (skipped.length) setError(`Skipped binary files: ${skipped.join(', ')}`);
      await loadTree();
    } catch (err) { setError('Folder upload failed: ' + err.message); }
    finally { setSaving(false); e.target.value = ''; }
  }

  // ── Download ───────────────────────────────────────────────────────────────

  function downloadActiveFile() {
    if (!activeFile) return;
    downloadText(activeFile.name, code || '');
    setDownloadMsg('Downloaded!');
    setTimeout(() => setDownloadMsg(''), 2000);
  }

  async function downloadWorkspace() {
    if (!tree) return;
    setDownloadMsg('Preparing download…');
    try {
      const flatFiles = flattenTree(tree);
      if (!flatFiles.length) { setDownloadMsg('No files to download'); setTimeout(() => setDownloadMsg(''), 2000); return; }
      await new Promise((resolve, reject) => {
        if (window.JSZip) { resolve(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
      const zip = new window.JSZip();
      for (const { path, node: fn } of flatFiles) {
        setDownloadMsg(`Packing ${fn.name}…`);
        zip.file(path, await api.getFile(roomId, fn.id) || '');
      }
      setDownloadMsg('Generating ZIP…');
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${roomName || 'coderoom'}-workspace.zip`; a.click();
      URL.revokeObjectURL(url);
      setDownloadMsg('ZIP downloaded!');
    } catch {
      setDownloadMsg('Downloading individually…');
      for (const { path, node: fn } of flattenTree(tree)) {
        try { downloadText(path.replace(/\//g, '__'), await api.getFile(roomId, fn.id) || ''); await new Promise(r => setTimeout(r, 100)); } catch { /* skip */ }
      }
      setDownloadMsg('Done!');
    }
    setTimeout(() => setDownloadMsg(''), 3000);
  }

  // ── AI helper ──────────────────────────────────────────────────────────────

  function handleInsertAiCode(newCode) {
    if (!activeFile) return;
    lastRemoteCode.current = '';
    setCode(newCode);
    setSaveMsg('unsaved');
    socketRef.current?.sendCodeUpdate(activeFile.id, newCode);
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveCode(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '`') { e.preventDefault(); setShowAiPanel(p => !p); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile, code]);

  // ── Sidebar resize ─────────────────────────────────────────────────────────

  useEffect(() => {
    function handleMouseMove(e) {
      if (!isResizing.current) return;
      let w = e.clientX;
      if (w < 150) w = 150; if (w > 600) w = 600;
      setSidebarWidth(w);
    }
    function handleMouseUp() {
      if (isResizing.current) { isResizing.current = false; document.body.style.cursor = 'default'; }
    }
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, []);

  // ── Typing indicator text ──────────────────────────────────────────────────

  const typingText = (() => {
    const names = [...typingUsers.values()].map(u => u.username);
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return `${names[0]} and ${names.length - 1} others are typing…`;
  })();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="editor-layout">
      {/* Hidden file inputs */}
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple onChange={handleFileUpload} />
      <input type="file" ref={folderInputRef} style={{ display: 'none' }}
        webkitdirectory="true" directory="true" multiple onChange={handleFolderUpload} />

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {t.type === 'join' ? '→ ' : '← '}{t.message}
          </div>
        ))}
      </div>

      {/* Modals */}
      {modal && <NewFileModal type={modal.type} onConfirm={handleCreate} onClose={() => setModal(null)} />}

      {deleteConfirm && (
        <div className="overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">Delete {deleteConfirm.isFolder ? 'Folder' : 'File'}</div>
            <div className="confirm-body">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
              {deleteConfirm.isFolder && <span> This will delete all contents inside.</span>}
            </div>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn-delete" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {viewCodeVersion && (
        <div className="view-code-overlay" onClick={() => setViewCodeVersion(null)}>
          <div className="view-code-modal" onClick={e => e.stopPropagation()}>
            <div className="view-code-header">
              <span>Code Version by {viewCodeVersion.username}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-icon" title="Download this version"
                  onClick={() => downloadText(`${activeFile?.name || 'file'}.v${viewCodeVersion.id}.txt`, viewCodeVersion.content)}>⬇</button>
                <button className="btn-icon" onClick={() => setViewCodeVersion(null)}>✕</button>
              </div>
            </div>
            <div className="view-code-body"><pre>{viewCodeVersion.content}</pre></div>
          </div>
        </div>
      )}

      {/* AI Review before save modal */}
      {showReviewModal && (
        <div className="overlay" onClick={() => setShowReviewModal(false)}>
          <div className="review-modal" onClick={e => e.stopPropagation()}>
            <div className="review-modal-header">
              <span>🔍 AI Review — {activeFile?.name}</span>
              <button className="btn-icon" onClick={() => setShowReviewModal(false)}>✕</button>
            </div>
            <div className="review-modal-body">
              {reviewLoading
                ? <div className="review-loading"><span className="ai-spinner-lg" /> Analyzing code...</div>
                : <pre className="review-result">{reviewResult}</pre>
              }
            </div>
            <div className="review-modal-footer">
              <button className="btn-cancel" onClick={() => setShowReviewModal(false)}>Cancel</button>
              <button className="run-btn" onClick={() => { setShowReviewModal(false); saveCode(); }}>
                💾 Save Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo"><span className="topbar-dot" />CodeRoom</div>
          <div className="topbar-room">
            <span className="topbar-room-label">room</span>
            <span className="topbar-room-name">{roomName}</span>
          </div>
          <span style={{
            marginLeft: 10, fontSize: 11, fontWeight: 700, letterSpacing: 1,
            padding: '2px 8px', borderRadius: 4,
            background: isAdmin ? '#7c3aed22' : '#0891b222',
            color: isAdmin ? '#a78bfa' : '#38bdf8',
            textTransform: 'uppercase'
          }}>{userRole}</span>

          {/* WS status */}
          <span className={`ws-dot ${wsConnected ? 'ws-dot--on' : 'ws-dot--off'}`}
            title={wsConnected ? 'Live — connected' : 'Offline — reconnecting'} />

          {activeFile && (
            <div className="topbar-file">
              <span className="topbar-sep">/</span>
              <span className="topbar-file-name">{activeFile.name}</span>
              {isDirty && <span className="dirty-dot" />}
            </div>
          )}
        </div>

        <div className="topbar-right">
          {/* Online users */}
          <div className="online-users">
            {[...onlineUsers.values()].slice(0, 8).map(u => (
              <div key={u.userId} className="online-avatar"
                style={{ background: u.color }} title={u.username}>
                {u.username.slice(0, 1).toUpperCase()}
              </div>
            ))}
            {onlineUsers.size > 8 && (
              <div className="online-avatar" style={{ background: '#484f58' }}>+{onlineUsers.size - 8}</div>
            )}
          </div>

          {isAdmin && inviteCode && (
            <div className="invite-code-box">
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>code</span>
              <code style={{ color: '#a78bfa', letterSpacing: 2, fontSize: 13, fontWeight: 700 }}>{inviteCode}</code>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: 0 }}
                title="Copy invite code" onClick={() => navigator.clipboard.writeText(inviteCode)}>⎘</button>
            </div>
          )}

          {downloadMsg && <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{downloadMsg}</span>}
          {saveMsg === 'unsaved' && <span className="save-badge unsaved">● unsaved</span>}
          {saveMsg === 'saved'   && <span className="save-badge saved">✓ saved</span>}
          {saveMsg === 'error'   && <span className="save-badge error-badge">✗ save failed</span>}

          {/* AI Panel toggle */}
          <button className={`run-btn ai-toggle-btn ${showAiPanel ? 'ai-toggle-btn--active' : ''}`}
            onClick={() => setShowAiPanel(p => !p)} title="AI Assistant (Ctrl+`)">
            🤖 AI
          </button>

          {activeFile && (
            <button className="run-btn" style={{ background: 'var(--bg4)', color: 'var(--text0)' }}
              title="Download current file" onClick={downloadActiveFile}>⬇ File</button>
          )}

          <button className="run-btn" style={{ background: 'var(--bg4)', color: 'var(--text0)' }}
            title="Download workspace as ZIP" onClick={downloadWorkspace} disabled={!tree}>⬇ ZIP</button>

          {/* Review & Save */}
          {activeFile && (
            <button className="run-btn review-save-btn" onClick={reviewAndSave}
              disabled={saving} title="AI Review then save">
              🔍 Review
            </button>
          )}

          <button className="run-btn" onClick={saveCode} disabled={!activeFile || saving}>
            {saving ? '◌ saving…' : '💾 Save'}
          </button>

          <div className="topbar-user">
            <div className="topbar-avatar">{(user.username || user.email || '?').slice(0, 2).toUpperCase()}</div>
          </div>
          <button className="leave-btn" onClick={onLeave} title="Leave room">⏻</button>
        </div>
      </header>

      {/* ── Main area ────────────────────────────────────────────────── */}
      <div className="editor-body">
        <aside className="sidebar" style={{ width: sidebarWidth }}>
          <div className="sidebar-tabs">
            <button className={`sidebar-tab ${sideTab === 'files'   ? 'active' : ''}`}
              onClick={() => setSideTab('files')} title="Files">⎘</button>
            <button className={`sidebar-tab ${sideTab === 'history' ? 'active' : ''}`}
              onClick={() => { setSideTab('history'); if (activeFile) loadVersions(activeFile.id); }}
              title="History">🕒</button>
            <button className={`sidebar-tab ${sideTab === 'people'  ? 'active' : ''}`}
              onClick={() => setSideTab('people')} title="Participants">◉</button>
          </div>

          <div className="sidebar-content">
            {/* Files tab */}
            {sideTab === 'files' && (
              <>
                <div className="sidebar-header">
                  <span className="sidebar-title">Explorer</span>
                  <div className="sidebar-actions" style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" title="Upload Files" onClick={() => fileInputRef.current.click()}>📄↑</button>
                    <button className="btn-icon" title="Upload Folder" onClick={() => folderInputRef.current.click()}>📁↑</button>
                    <button className="btn-icon" title="Download ZIP" onClick={downloadWorkspace}>⬇</button>
                    <button className="btn-icon" title="Refresh" onClick={loadTree}>↺</button>
                  </div>
                </div>
                {error && (
                  <div className="sidebar-error">
                    {error}
                    <button style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                      onClick={() => setError('')}>✕</button>
                  </div>
                )}
                <FileTree
                  tree={tree}
                  selectedId={activeFile?.id}
                  onSelect={selectFile}
                  onAddFile={(parentId) => setModal({ type: 'FILE', parentId })}
                  onAddFolder={(parentId) => setModal({ type: 'FOLDER', parentId })}
                  onDelete={requestDelete}
                  onRename={handleRename}
                />
              </>
            )}

            {/* History tab */}
            {sideTab === 'history' && (
              <>
                <div className="sidebar-header">
                  <span className="sidebar-title">History</span>
                  <button className="btn-icon" title="Refresh"
                    onClick={() => activeFile && loadVersions(activeFile.id)}>↺</button>
                </div>
                {!activeFile
                  ? <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>Open a file to see its history.</div>
                  : (
                    <div className="history-list">
                      {versions.map(v => (
                        <div key={v.id} className="history-item">
                          <div className="history-header">
                            <span className="history-user">{v.username}</span>
                            <span className={`history-status ${v.status}`}>{v.status.replace('_', ' ')}</span>
                          </div>
                          <div className="history-time">{new Date(v.createdAt).toLocaleString()}</div>
                          {v.reviewedBy && (
                            <div className="history-reviewer">Reviewed by {v.reviewedBy} on {new Date(v.reviewedAt).toLocaleString()}</div>
                          )}
                          <div className="history-actions">
                            <button className="history-btn revert" onClick={() => setViewCodeVersion(v)}>View</button>
                            <button className="history-btn revert" onClick={() => revertToVersion(v.id)}>Revert</button>
                            {isAdmin && (
                              <>
                                <button className="history-btn review" onClick={() => reviewVersion(v.id, 'REVIEWED')}>✓</button>
                                <button className="history-btn no-change" onClick={() => reviewVersion(v.id, 'NO_CHANGE')}>✗</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </>
            )}

            {/* People tab */}
            {sideTab === 'people' && (
              <Participants
                participants={participants}
                roomId={roomId}
                currentUserId={user.id}
                onlineUsers={onlineUsers}
              />
            )}
          </div>
        </aside>

        <div className="resize-handle"
          onMouseDown={e => {
            e.preventDefault();
            isResizing.current = true;
            document.body.style.cursor = 'col-resize';
          }} />

        <main className="editor-main">
          {activeFile ? (
            <>
              <div className="tab-bar">
                <div className="editor-tab active">
                  <span className="editor-tab-name">{activeFile.name}</span>
                  {isDirty && <span className="dirty-dot" />}
                  <button className="tab-download-btn" title="Download file" onClick={downloadActiveFile}>⬇</button>
                </div>
                {typingText && (
                  <div className="typing-indicator">{typingText}</div>
                )}
              </div>
              <div className="editor-area">
                <CodeEditor
                  content={code}
                  language={activeFile.language}
                  onChange={handleCodeChange}
                />
              </div>
            </>
          ) : (
            <div className="empty-editor">
              <div className="empty-icon">◆</div>
              <p className="empty-title">No file open</p>
              <p className="empty-sub">Select a file from the explorer, upload from your system, or create a new one.</p>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="run-btn" style={{ fontSize: 12 }} onClick={() => fileInputRef.current.click()}>📄 Upload File</button>
                <button className="run-btn" style={{ fontSize: 12 }} onClick={() => folderInputRef.current.click()}>📁 Upload Folder</button>
              </div>
            </div>
          )}
        </main>

        {/* AI Panel */}
        {showAiPanel && (
          <AiPanel
            code={code}
            language={activeFile?.language || 'plaintext'}
            filename={activeFile?.name || ''}
            roomId={roomId}
            fileNodeId={activeFile?.id}
            onInsertCode={handleInsertAiCode}
            onClose={() => setShowAiPanel(false)}
          />
        )}
      </div>

      <footer className="statusbar">
        <span className="status-item accent">◆ CodeRoom</span>
        {activeFile && (
          <>
            <span className="status-sep">|</span>
            <span className="status-item">{activeFile.language || 'plaintext'}</span>
            <span className="status-sep">|</span>
            <span className="status-item">{activeFile.name}</span>
          </>
        )}
        <span className="status-item" style={{ marginLeft: 'auto', marginRight: 8 }}>
          {wsConnected
            ? <><span style={{ color: '#3fb950' }}>●</span> Live</>
            : <><span style={{ color: '#f85149' }}>●</span> Reconnecting</>
          }
        </span>
        <span className="status-right">{saving ? 'Saving…' : 'Ctrl+S · Ctrl+` for AI'}</span>
      </footer>
    </div>
  );
}
