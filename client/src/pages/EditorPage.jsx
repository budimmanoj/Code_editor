import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Download, Save, LogOut, Code2, Upload, FolderUp, FileCode, Bot, History, Users, RefreshCw, Archive, CheckCircle2, XCircle } from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { api, tokenStore } from '../api/client';
import { RoomSocket } from '../websocket/RoomSocket';
import { CodeRoomYjsProvider } from '../utils/yjsProvider';
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
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg', 'bmp', 'tiff',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'zip', 'tar', 'gz', 'rar', '7z', 'bz2',
    'exe', 'dll', 'so', 'dylib', 'bin', 'class', 'jar', 'war',
    'mp3', 'mp4', 'mov', 'avi', 'mkv', 'wav', 'flac',
    'ttf', 'otf', 'woff', 'woff2', 'eot', 'db', 'sqlite', 'lock',
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

// ── Tree utilities ─────────────────────────────────────────────────────────────

/** Recursively flatten a FileTreeDto into {folders, files} arrays with path info for the scope selector */
function flattenTreeForScope(node, parentPath = '') {
  if (!node) return { folders: [], files: [] };
  const result = { folders: [], files: [] };
  const children = node.children || [];

  // Handle virtual root
  if (node.id === null && node.name === '__root__') {
    for (const child of children) {
      const sub = flattenTreeForScope(child, '');
      result.folders.push(...sub.folders);
      result.files.push(...sub.files);
    }
    return result;
  }

  const path = parentPath ? `${parentPath}/${node.name}` : node.name;

  if (node.fileType === 'FOLDER') {
    result.folders.push({ id: node.id, name: node.name, path });
    for (const child of children) {
      const sub = flattenTreeForScope(child, path);
      result.folders.push(...sub.folders);
      result.files.push(...sub.files);
    }
  } else {
    result.files.push({ id: node.id, name: node.name, path });
  }

  return result;
}

/** Compute simple line diff stats from two content strings */
function computeDiffStats(oldContent, newContent) {
  if (!oldContent && !newContent) return { added: 0, removed: 0 };
  const oldLines = (oldContent || '').split('\n');
  const newLines = (newContent || '').split('\n');
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  const added = newLines.filter(l => !oldSet.has(l)).length;
  const removed = oldLines.filter(l => !newSet.has(l)).length;
  return { added, removed };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditorPage({ user, roomId, roomName, userRole, onLeave }) {
  // Core state
  const [tree, setTree] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [activeFile, setActiveFile] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(`cr_file_${roomId}`)); } catch { return null; }
  });
  const [code, setCode] = useState(() => {
    try {
      const file = JSON.parse(sessionStorage.getItem(`cr_file_${roomId}`));
      if (file) return sessionStorage.getItem(`cr_code_${roomId}_${file.id}`) || '';
    } catch { /* ignore */ }
    return '';
  });
  const [savedCode, setSavedCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [versions, setVersions] = useState([]);
  const [historyScope, setHistoryScope] = useState({ type: 'CODEBASE', id: roomId, name: 'Codebase' });
  const [modal, setModal] = useState(null);
  const [sideTab, setSideTab] = useState('files');
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [aiPanelWidth, setAiPanelWidth] = useState(420);
  const [viewCodeVersion, setViewCodeVersion] = useState(null);
  const [historyTab, setHistoryTab] = useState('approvals');
  const [viewCodeOldContent, setViewCodeOldContent] = useState('');
  const [downloadMsg, setDownloadMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // WebSocket / Collaboration state
  const [wsConnected, setWsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Map()); // userId → {userId, username, color}
  const [typingUsers, setTypingUsers] = useState(new Map()); // userId → {username, color}
  const [toasts, setToasts] = useState([]);

  // Yjs Provider State
  const [yjsProvider, setYjsProvider] = useState(null);

  // Pending review state (admin)
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingFileIds, setPendingFileIds] = useState(new Set());
  const [rejectDialog, setRejectDialog] = useState(null); // { versionId } | null
  const [rejectComment, setRejectComment] = useState('');

  // AI Panel state
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Upload drag-drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // { done, total, label }

  // Refs
  const socketRef = useRef(null);
  const activeFileRef = useRef(activeFile);
  const reviewAndSaveRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const historyRequestRef = useRef(0);

  const isAdmin = userRole === 'ADMIN';
  const isDirty = code !== savedCode;

  const onlineUsersRef = useRef(onlineUsers);

  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);
  useEffect(() => { onlineUsersRef.current = onlineUsers; }, [onlineUsers]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reviewAndSaveRef.current = reviewAndSave; }, [reviewAndSave]);

  // ── Drag to Resize (Pointer Capture + RAF for smooth 60fps) ─────────────────

  const rafRef = useRef(null);

  const startSidebarDrag = useCallback((e) => {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setSidebarWidth(Math.max(160, Math.min(600, ev.clientX)));
      });
    };
    const onUp = () => {
      handle.releasePointerCapture(e.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  }, []);

  const startAiDrag = useCallback((e) => {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setAiPanelWidth(Math.max(300, Math.min(900, window.innerWidth - ev.clientX)));
      });
    };
    const onUp = () => {
      handle.releasePointerCapture(e.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  }, []);

  // ── Toast helper ───────────────────────────────────────────────────────────

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ── WebSocket setup ────────────────────────────────────────────────────────

  useEffect(() => {
    const socket = new RoomSocket(roomId, tokenStore.get());
    socketRef.current = socket;

    socket.on('connected', () => setWsConnected(true));
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

    socket.on('YJS_UPDATE', (msg) => {
      setYjsProvider(prev => {
        if (prev && prev.fileId === msg.fileId) {
          prev.handleUpdate(msg.update);
        }
        return prev;
      });
    });

    socket.on('YJS_AWARENESS', (msg) => {
      setYjsProvider(prev => {
        if (prev && prev.fileId === msg.fileId) {
          prev.handleAwareness(msg.update);
        }
        return prev;
      });
    });

    socket.on('YJS_STATE_RESPONSE', (msg) => {
      setYjsProvider(prev => {
        if (prev && prev.fileId === msg.fileId) {
          prev.handleStateResponse(msg.updates);
        }
        return prev;
      });
    });

    socket.on('FILE_CREATED', (msg) => {
      // Reload the file tree so the new file appears for all collaborators
      loadTree();
    });

    socket.on('CODE_UPDATE', (msg) => {
      if (msg.source === 'AI') {
        // Reload tree to bump the version number in the frontend state
        loadTree();
        if (activeFileRef.current && activeFileRef.current.id === msg.fileId) {
          setCode(msg.content);
          setSavedCode(msg.content);

          // Force recreate YjsProvider to apply remote changes without broadcasting YJS_UPDATE
          setYjsProvider(prev => {
            if (prev) {
              const wsSendFn = prev.wsSendFn;
              const myColor = prev.awareness.getLocalState()?.user?.color || '#58a6ff';
              prev.destroy();
              return new CodeRoomYjsProvider(wsSendFn, roomId, msg.fileId, user.username || user.email, myColor, msg.content);
            }
            return prev;
          });
        }
      }
    });
    // Admin approved a version — do NOT overwrite the collaborative editor content!
    socket.on('REVISION_APPROVED', (msg) => {
      if (activeFileRef.current && activeFileRef.current.id === msg.fileId) {
        addToast(`✅ ${msg.approvedBy} approved this file`, 'info');
      }
      // Refresh version list if history tab is open
      setVersions(prev => prev.map(v =>
        v.id === msg.versionId ? { ...v, status: 'REVIEWED', reviewedBy: msg.approvedBy } : v
      ));
      // Decrement pending badge
      setPendingCount(c => Math.max(0, c - 1));
    });

    // Admin rejected a version
    socket.on('REVISION_REJECTED', (msg) => {
      setVersions(prev => prev.map(v =>
        v.id === msg.versionId ? { ...v, status: 'REJECTED' } : v
      ));
      setPendingCount(c => Math.max(0, c - 1));
      addToast(`❌ A version was rejected: ${msg.reason || 'no comment'}`, 'leave');
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
    try {
      const newTree = await api.getFileTree(roomId);
      setTree(newTree);
      
      // Keep activeFile's version in sync with the new tree
      setActiveFile(prev => {
        if (!prev) return prev;
        const findNode = (nodes) => {
          for (let n of nodes) {
            if (n.id === prev.id) return n;
            if (n.children) {
              const res = findNode(n.children);
              if (res) return res;
            }
          }
          return null;
        };
        const updatedNode = findNode([newTree]);
        if (updatedNode && updatedNode.version !== prev.version) {
          return { ...prev, version: updatedNode.version };
        }
        return prev;
      });
    } catch { setTree(null); }
  }, [roomId]);

  const loadParticipants = useCallback(async () => {
    try {
      const data = await api.getRoomParticipants(roomId);
      setParticipants(data.participants || []);
      if (data.inviteCode) setInviteCode(data.inviteCode);
    } catch { /* ignore */ }
  }, [roomId]);

  const loadPendingFiles = useCallback(async () => {
    try {
      const pending = await api.getPendingVersions(roomId);
      setPendingCount(pending.length);
      setPendingFileIds(new Set(pending.map(v => v.fileNodeId)));
    } catch { /* ignore */ }
  }, [roomId]);

  // Sync viewCodeOldContent when viewing a diff
  useEffect(() => {
    if (viewCodeVersion && viewCodeVersion.fileNodeId) {
      if (viewCodeVersion.status === 'PENDING') {
        // Pending approval: Compare against CURRENT canonical file code
        api.getFile(roomId, viewCodeVersion.fileNodeId)
          .then(content => setViewCodeOldContent(content))
          .catch(() => setViewCodeOldContent('// Error loading original code'));
      } else {
        // Historical version: Compare against chronologically previous version
        const idx = versions.findIndex(v => v.id === viewCodeVersion.id);
        if (idx !== -1 && idx + 1 < versions.length) {
          setViewCodeOldContent(versions[idx + 1].content);
        } else {
          setViewCodeOldContent('');
        }
      }
    }
  }, [viewCodeVersion, versions, roomId]);

  const loadVersions = useCallback(async (scope) => {
    if (!scope || !roomId) return;
    const reqId = ++historyRequestRef.current;

    try {
      const data = await api.getHistory(roomId, scope.type, scope.id);
      if (historyRequestRef.current !== reqId) return; // stale response
      setVersions(data);
    } catch (err) {
      console.error('Failed to load history', err);
    }
  }, [roomId]);

  useEffect(() => {
    if (sideTab === 'history') {
      loadVersions(historyScope);
    }
  }, [sideTab, historyScope, loadVersions]);

  // Admin invite code
  useEffect(() => {
    if (isAdmin) {
      api.getMyProfile().then(profile => {
        const r = (profile.roomsCreated || []).find(r => r.id === roomId);
        if (r) setInviteCode(r.inviteCode);
      }).catch(() => { });
    }
  }, [isAdmin, roomId]);

  // Initial load (no polling — WS handles real-time)
  useEffect(() => {
    loadTree();
    loadParticipants();
    loadPendingFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Provider creation on file switch or reload
  useEffect(() => {
    if (!activeFile || !roomId) {
      setYjsProvider(prev => { if (prev) prev.destroy(); return null; });
      return;
    }

    let isMounted = true;
    api.getFile(roomId, activeFile.id).then(data => {
      if (!isMounted) return;
      const content = typeof data === 'string' ? data : (data?.content || '');
      setSavedCode(content);

      const draft = sessionStorage.getItem(`cr_code_${roomId}_${activeFile.id}`);
      const initialContent = (!draft || draft === content) ? content : draft;
      setCode(initialContent);
      if (!draft || draft === content) setSaveMsg('');

      // Initialize Yjs Provider
      setYjsProvider(prev => {
        if (prev) prev.destroy();
        const myColor = onlineUsersRef.current.get(user.id)?.color || '#58a6ff';
        const wsSendFn = (msg) => socketRef.current?.send(msg);
        return new CodeRoomYjsProvider(wsSendFn, roomId, activeFile.id, user.username || user.email, myColor, initialContent);
      });

      loadVersions(historyScope);
    }).catch(err => {
      if (isMounted) setError('Could not load file: ' + err.message);
    });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile?.id, roomId, user.username, user.email]);

  // Session persistence
  useEffect(() => {
    if (activeFile) sessionStorage.setItem(`cr_file_${roomId}`, JSON.stringify(activeFile));
    else sessionStorage.removeItem(`cr_file_${roomId}`);
  }, [activeFile, roomId]);

  useEffect(() => {
    if (code && activeFile) sessionStorage.setItem(`cr_code_${roomId}_${activeFile.id}`, code);
    else if (activeFile) sessionStorage.removeItem(`cr_code_${roomId}_${activeFile.id}`);
  }, [code, roomId, activeFile]);

  // ── File selection ─────────────────────────────────────────────────────────

  async function selectFile(node) {
    if (node.id === null && node.name === '__root__') {
      setHistoryScope({ type: 'CODEBASE', id: roomId, name: 'Codebase' });
      return;
    }
    if (node.fileType === 'FOLDER') {
      setHistoryScope({ type: 'FOLDER', id: node.id, name: node.name + '/' });
      return;
    }
    setActiveFile(node);
    setHistoryScope({ type: 'FILE', id: node.id, name: node.name });
    // Content loading and provider creation is now handled by the activeFile?.id useEffect
  }

  // ── Code editing & saving ──────────────────────────────────────────────────

  function handleCodeChange(newVal) {
    // This is only used as a fallback if ytext isn't passed, but we still update local state
    setCode(newVal);
  }

  // ── Explicit Save (Submit for Review) ─────────────────────────────────────

  async function reviewAndSave() {
    if (!activeFile) return;
    setSaving(true);
    setSaveMsg('submitting...');
    try {
      // Get the latest text directly from the Yjs document if available
      const textToSave = yjsProvider ? yjsProvider.ytext.toString() : code;

      const data = await api.updateCode({
        roomId,
        fileNodeId: activeFile.id,
        content: textToSave
      });
      setSavedCode(textToSave);
      setSaveMsg(typeof data === 'string' ? data : 'Saved'); // e.g. "Code submitted for review"
      addToast('Change submitted successfully', 'info');
      loadPendingFiles();
      if (sideTab === 'history') {
        loadVersions(historyScope);
      }
    } catch (err) {
      setSaveMsg('error');
      addToast('Failed to save: ' + (err.message || 'unknown error'), 'error');
      console.error('[Save] Error:', err);
    } finally {
      setTimeout(() => setSaveMsg(''), 3000);
      setSaving(false);
    }
  }

  // ── Versions ───────────────────────────────────────────────────────────────

  async function revertToVersion(versionId) {
    if (!activeFile) return;
    try {
      const newCode = await api.revertToVersion(roomId, activeFile.id, versionId);
      if (yjsProvider) {
        yjsProvider.doc.transact(() => {
          yjsProvider.ytext.delete(0, yjsProvider.ytext.length);
          yjsProvider.ytext.insert(0, newCode);
        });
      } else {
        setCode(newCode);
      }
      setSavedCode(newCode);
      setSaveMsg('saved');
      setTimeout(() => setSaveMsg(''), 2000);
      loadVersions(historyScope);
    } catch (e) { setError('Failed to revert: ' + e.message); }
  }

  async function approveVersion(versionId) {
    try {
      await api.approveVersion(roomId, versionId);
      loadVersions(historyScope);
      loadPendingFiles();
      addToast('✅ Version approved!', 'info');
    } catch (e) { setError('Failed to approve: ' + e.message); }
  }

  async function rejectVersion(versionId, comment) {
    try {
      await api.rejectVersion(roomId, versionId, comment || '');
      loadVersions(historyScope);
      loadPendingFiles();
      setRejectDialog(null); setRejectComment('');
      addToast('❌ Version rejected', 'leave');
    } catch (e) { setError('Failed to reject: ' + e.message); }
  }

  // Refresh pending count whenever versions load (admin only)
  useEffect(() => {
    if (isAdmin && versions.length > 0) {
      setPendingCount(versions.filter(v => v.status === 'PENDING').length);
    }
  }, [versions, isAdmin]);

  // ── Create / Delete / Rename ───────────────────────────────────────────────

  async function handleCreate({ name, type, language }) {
    setModal(null); // Close immediately for optimistic feel
    const parentId = modal.parentId;
    try {
      await api.createFileNode({ roomId, parentId, name, type, language });
      await loadTree();
    } catch (e) { setError(e.message); }
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
    const textFiles = files.filter(f => !isBinaryFile(f.name));
    const skipped = files.filter(f => isBinaryFile(f.name)).map(f => f.name);
    if (!textFiles.length) { setError(`Skipped binary files: ${skipped.join(', ')}`); return; }

    setSaving(true); setError('');
    setUploadProgress({ done: 0, total: textFiles.length, label: 'Reading files…' });

    try {
      // Read all files in parallel (reading is cheap — no server calls yet)
      const prepared = await Promise.all(
        textFiles.map(async (file) => ({
          name: file.name,
          language: langFromExt(file.name),
          content: sanitizeText(await file.text()),
        }))
      );

      setUploadProgress({ done: 0, total: prepared.length, label: 'Uploading…' });

      // Upload in batches of 6 (same as folder upload — avoids overwhelming the server)
      const CONCURRENCY = 6;
      for (let i = 0; i < prepared.length; i += CONCURRENCY) {
        const batch = prepared.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map(async ({ name, language, content }) => {
            const created = await api.createFileNode({ roomId, parentId: null, name, type: 'FILE', language });
            await api.updateCode({ roomId, fileNodeId: created.id, content });
            setUploadProgress(p => ({ ...p, done: p.done + 1 }));
          })
        );
      }

      if (skipped.length) setError(`Skipped binary files: ${skipped.join(', ')}`);
      addToast(`Uploaded ${prepared.length} file(s)`, 'info');
      await loadTree();
    } catch (err) { setError('Upload failed: ' + err.message); }
    finally { setSaving(false); setUploadProgress(null); e.target.value = ''; }
  }

  async function handleFolderUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const textFiles = files.filter(f => !isBinaryFile(f.name));
    const skipped = files.filter(f => isBinaryFile(f.name)).map(f => f.webkitRelativePath);

    setSaving(true); setError('');
    setUploadProgress({ done: 0, total: textFiles.length, label: 'Building folder structure…' });

    try {
      // ── Step 1: Create all unique FOLDER nodes (must be sequential for parent refs) ──
      const dirMap = { '': null };
      const allDirPaths = new Set();
      for (const file of textFiles) {
        const parts = file.webkitRelativePath.split('/');
        let path = '';
        for (let i = 0; i < parts.length - 1; i++) {
          path = path ? `${path}/${parts[i]}` : parts[i];
          allDirPaths.add(path);
        }
      }
      // Sort so parents come before children
      const sortedDirs = [...allDirPaths].sort((a, b) => a.split('/').length - b.split('/').length);
      for (const dirPath of sortedDirs) {
        if (dirPath in dirMap) continue;
        const parts = dirPath.split('/');
        const dirName = parts[parts.length - 1];
        const parentKey = parts.slice(0, -1).join('/');
        const created = await api.createFileNode({ roomId, parentId: dirMap[parentKey] ?? null, name: dirName, type: 'FOLDER' });
        dirMap[dirPath] = created.id;
      }

      setUploadProgress({ done: 0, total: textFiles.length, label: 'Reading & uploading files…' });

      // ── Step 2: Read all file contents in parallel ──
      const prepared = await Promise.all(
        textFiles.map(async (file) => {
          const parts = file.webkitRelativePath.split('/');
          const fileName = parts[parts.length - 1];
          const parentKey = parts.slice(0, -1).join('/');
          return {
            name: fileName,
            language: langFromExt(fileName),
            parentId: dirMap[parentKey] ?? null,
            content: sanitizeText(await file.text()),
          };
        })
      );

      // ── Step 3: Upload files in parallel (up to 6 at a time) ──
      const CONCURRENCY = 6;
      for (let i = 0; i < prepared.length; i += CONCURRENCY) {
        const batch = prepared.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map(async ({ name, language, parentId, content }) => {
            const created = await api.createFileNode({ roomId, parentId, name, type: 'FILE', language });
            await api.updateCode({ roomId, fileNodeId: created.id, content });
            setUploadProgress(p => ({ ...p, done: p.done + 1 }));
          })
        );
      }

      if (skipped.length) setError(`Skipped binary files: ${skipped.join(', ')}`);
      addToast(`Uploaded folder — ${prepared.length} files`, 'info');
      await loadTree();
    } catch (err) { setError('Folder upload failed: ' + err.message); }
    finally { setSaving(false); setUploadProgress(null); e.target.value = ''; }
  }

  // ── Drag-and-Drop on empty editor ─────────────────────────────────────────

  function handleDropzoneDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }
  function handleDropzoneDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
  }
  async function handleDropzoneDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const items = [...(e.dataTransfer.items || [])];
    const files = [...(e.dataTransfer.files || [])];

    // Detect folder drop via DataTransferItem.webkitGetAsEntry
    const hasFolder = items.some(item => {
      try { return item.webkitGetAsEntry?.()?.isDirectory; } catch { return false; }
    });

    if (hasFolder) {
      // Collect all file entries recursively
      const allFileEntries = [];
      async function readEntry(entry, path = '') {
        if (entry.isFile) {
          allFileEntries.push({ entry, path });
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          const entries = await new Promise(res => reader.readEntries(res));
          for (const e2 of entries) await readEntry(e2, path ? `${path}/${entry.name}` : entry.name);
        }
      }
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) await readEntry(entry, '');
      }

      if (!allFileEntries.length) return;
      // Read all as File objects
      const fileObjs = await Promise.all(
        allFileEntries.map(({ entry, path }) =>
          new Promise(res => entry.file(f => res({ file: f, relativePath: `${path ? path + '/' : ''}${f.name}` })))
        )
      );
      // Reuse folder upload logic inline
      await uploadFromFileList(fileObjs.map(({ file, relativePath }) => ({ file, relativePath })));
    } else {
      // Plain files drop
      const fakeEvt = { target: { files, value: '' } };
      await handleFileUpload(fakeEvt);
    }
  }

  async function uploadFromFileList(fileList) {
    const textFiles = fileList.filter(({ file }) => !isBinaryFile(file.name));
    const skipped = fileList.filter(({ file }) => isBinaryFile(file.name)).map(({ relativePath }) => relativePath);
    if (!textFiles.length) { setError(`Skipped binary files: ${skipped.join(', ')}`); return; }

    setSaving(true); setError('');
    setUploadProgress({ done: 0, total: textFiles.length, label: 'Building folder structure…' });

    try {
      const dirMap = { '': null };
      const allDirPaths = new Set();
      for (const { relativePath } of textFiles) {
        const parts = relativePath.split('/');
        let path = '';
        for (let i = 0; i < parts.length - 1; i++) {
          path = path ? `${path}/${parts[i]}` : parts[i];
          allDirPaths.add(path);
        }
      }
      const sortedDirs = [...allDirPaths].sort((a, b) => a.split('/').length - b.split('/').length);
      for (const dirPath of sortedDirs) {
        if (dirPath in dirMap) continue;
        const parts = dirPath.split('/');
        const dirName = parts[parts.length - 1];
        const parentKey = parts.slice(0, -1).join('/');
        const created = await api.createFileNode({ roomId, parentId: dirMap[parentKey] ?? null, name: dirName, type: 'FOLDER' });
        dirMap[dirPath] = created.id;
      }
      setUploadProgress({ done: 0, total: textFiles.length, label: 'Uploading files…' });
      const prepared = await Promise.all(
        textFiles.map(async ({ file, relativePath }) => {
          const parts = relativePath.split('/');
          const fileName = parts[parts.length - 1];
          const parentKey = parts.slice(0, -1).join('/');
          return { name: fileName, language: langFromExt(fileName), parentId: dirMap[parentKey] ?? null, content: sanitizeText(await file.text()) };
        })
      );
      const CONCURRENCY = 6;
      for (let i = 0; i < prepared.length; i += CONCURRENCY) {
        await Promise.all(prepared.slice(i, i + CONCURRENCY).map(async ({ name, language, parentId, content }) => {
          const created = await api.createFileNode({ roomId, parentId, name, type: 'FILE', language });
          await api.updateCode({ roomId, fileNodeId: created.id, content });
          setUploadProgress(p => ({ ...p, done: p.done + 1 }));
        }));
      }
      if (skipped.length) setError(`Skipped binary files: ${skipped.join(', ')}`);
      addToast(`Uploaded ${prepared.length} files`, 'info');
      await loadTree();
    } catch (err) { setError('Upload failed: ' + err.message); }
    finally { setSaving(false); setUploadProgress(null); }
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
    if (yjsProvider) {
      yjsProvider.doc.transact(() => {
        yjsProvider.ytext.delete(0, yjsProvider.ytext.length);
        yjsProvider.ytext.insert(0, newCode);
      });
    } else {
      setCode(newCode);
    }
    setSaveMsg('unsaved');
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); reviewAndSaveRef.current?.(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '`') { e.preventDefault(); setShowAiPanel(p => !p); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // reviewAndSaveRef is a stable ref
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
          <div className="view-code-modal" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '1200px', height: '90%' }}>
            <div className="view-code-header">
              <span>Code Version by {viewCodeVersion.username}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-icon" title="Download this version"
                  onClick={() => downloadText(`${activeFile?.name || 'file'}.v${viewCodeVersion.id}.txt`, viewCodeVersion.content)}>⬇</button>
                <button className="btn-icon" onClick={() => setViewCodeVersion(null)}>✕</button>
              </div>
            </div>
            <div className="view-code-body" style={{ overflow: 'auto', background: '#fff' }}>
              <ReactDiffViewer
                oldValue={viewCodeOldContent}
                newValue={viewCodeVersion.content}
                splitView={true}
                useDarkTheme={false}
                leftTitle={viewCodeVersion.status === 'PENDING' ? 'Current Approved' : 'Previous Version'}
                rightTitle={viewCodeVersion.status === 'PENDING' ? 'Proposed Changes' : `Version ${viewCodeVersion.id.substring(0, 8)}`}
              />
            </div>
          </div>
        </div>
      )}


      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">
            <Code2 size={16} />
            CodeRoom
            <span className="logo-dot" />
          </div>
          <div className="topbar-room">
            <span className="topbar-room-label">room</span>
            <span className="topbar-room-name">{roomName}</span>
          </div>

          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: `${onlineUsers.get(user.id)?.color || '#58a6ff'}22`,
            color: onlineUsers.get(user.id)?.color || '#58a6ff',
            textTransform: 'uppercase', border: `1px solid ${onlineUsers.get(user.id)?.color || '#58a6ff'}`
          }}>{userRole}</span>

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

        <div className="topbar-center">
          <div className="online-users">
            {[...onlineUsers.values()].slice(0, 5).map(u => (
              <div key={u.userId} className="online-avatar"
                style={{ background: u.color }} title={u.username}>
                {u.username.slice(0, 1).toUpperCase()}
              </div>
            ))}
            {onlineUsers.size > 5 && (
              <div className="online-avatar" style={{ background: 'var(--bg4)', color: 'var(--text1)' }}>+{onlineUsers.size - 5}</div>
            )}
          </div>
        </div>

        <div className="topbar-right">
          {downloadMsg && <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{downloadMsg}</span>}
          {saveMsg === 'unsaved' && <span className="save-badge unsaved">● unsaved</span>}
          {saveMsg === 'saving' && <span className="save-badge saved">● saving...</span>}
          {saveMsg === 'saved' && <span className="save-badge saved">✓ saved</span>}
          {saveMsg === 'error' && <span className="save-badge error-badge">✗ save failed</span>}

          <button className={`topbar-btn ${showAiPanel ? 'active' : ''}`}
            onClick={() => setShowAiPanel(p => !p)} title="AI Assistant (Ctrl+`)">
            <Bot size={18} />
          </button>

          <button className="topbar-btn" title="Download workspace as ZIP" onClick={downloadWorkspace} disabled={!tree}>
            <Archive size={18} />
          </button>

          <button className="topbar-btn" onClick={reviewAndSave} disabled={!activeFile || saving} title="Save (Ctrl+S)">
            <Save size={18} />
          </button>

          <button className="topbar-btn" onClick={onLeave} title="Leave room">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* ── Main area ────────────────────────────────────────────────── */}
      <div className="editor-body" style={{ gridTemplateColumns: `${sidebarWidth}px 4px 1fr ${showAiPanel ? `4px ${aiPanelWidth}px` : ''}` }}>
        <aside className="sidebar">
          <div className="sidebar-tabs">
            <button className={`sidebar-tab ${sideTab === 'files' ? 'active' : ''}`}
              onClick={() => setSideTab('files')} title="Files"><FileCode size={20} /></button>
            <button className={`sidebar-tab ${sideTab === 'history' ? 'active' : ''}`}
              onClick={() => { setSideTab('history'); loadVersions(historyScope); }}
              title="History" style={{ position: 'relative' }}>
              <History size={20} />
              {isAdmin && pendingCount > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 2,
                  background: '#f97316', color: '#fff',
                  borderRadius: '50%', fontSize: 9, width: 14, height: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, lineHeight: 1,
                }}>{pendingCount > 9 ? '9+' : pendingCount}</span>
              )}
            </button>
            <button className={`sidebar-tab ${sideTab === 'people' ? 'active' : ''}`}
              onClick={() => setSideTab('people')} title="Participants"><Users size={20} /></button>
          </div>

          <div className="sidebar-content">
            {/* Files tab */}
            <div className={sideTab === 'files' ? '' : 'hide'}>
              <div className="sidebar-header">
                <span className="sidebar-title">Explorer</span>
                <div className="sidebar-actions" style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-icon" title="Upload Files" onClick={() => fileInputRef.current.click()}><Upload size={14} /></button>
                  <button className="btn-icon" title="Upload Folder" onClick={() => folderInputRef.current.click()}><FolderUp size={14} /></button>
                  <button className="btn-icon" title="Refresh" onClick={loadTree}><RefreshCw size={14} /></button>
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
                pendingIds={pendingFileIds}
                onSelect={(id, name) => { selectFile(id, name); setHistoryScope({ type: 'FILE', id, name }); }}
                onAddFile={(parentId) => setModal({ type: 'FILE', parentId })}
                onAddFolder={(parentId) => setModal({ type: 'FOLDER', parentId })}
                onDelete={requestDelete}
                onRename={handleRename}
              />
            </div>

            {/* History tab */}
            <div className={sideTab === 'history' ? '' : 'hide'} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div className="sidebar-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px', paddingBottom: '0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="sidebar-title">History</span>
                  <button className="btn-icon" title="Refresh" onClick={() => loadVersions(historyScope)}>
                    <RefreshCw size={14} />
                  </button>
                </div>

                {/* Scope Selector — real files + folders from tree */}
                {(() => {
                  const { folders, files } = flattenTreeForScope(tree);
                  const scopeVal = historyScope.type === 'CODEBASE' ? '__codebase__'
                    : `${historyScope.type}:${historyScope.id}`;
                  return (
                    <>
                      <label style={{ fontSize: '10px', color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scope</label>
                      <select
                        value={scopeVal}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '__codebase__') {
                            setHistoryScope({ type: 'CODEBASE', id: roomId, name: 'Entire Codebase' });
                          } else if (val.startsWith('FOLDER:')) {
                            const id = val.replace('FOLDER:', '');
                            const folder = folders.find(f => f.id === id);
                            setHistoryScope({ type: 'FOLDER', id, name: folder?.path || 'Folder' });
                          } else if (val.startsWith('FILE:')) {
                            const id = val.replace('FILE:', '');
                            const file = files.find(f => f.id === id);
                            setHistoryScope({ type: 'FILE', id, name: file?.name || 'File' });
                          }
                        }}
                        style={{
                          background: 'var(--bg2)', color: 'var(--text0)', border: '1px solid var(--line2)',
                          borderRadius: '4px', padding: '5px 8px', fontSize: '12px', outline: 'none', width: '100%',
                        }}
                      >
                        <option value="__codebase__">Entire Codebase</option>
                        {folders.length > 0 && (
                          <optgroup label="── Folders">
                            {folders.map(f => (
                              <option key={f.id} value={`FOLDER:${f.id}`}>{f.path}/</option>
                            ))}
                          </optgroup>
                        )}
                        {files.length > 0 && (
                          <optgroup label="── Files">
                            {files.map(f => (
                              <option key={f.id} value={`FILE:${f.id}`}>{f.path}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </>
                  );
                })()}

                {/* Approvals / Versions tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--line1)', marginTop: '4px' }}>
                  <button
                    onClick={() => setHistoryTab('approvals')}
                    style={{
                      flex: 1, padding: '7px 0', background: 'transparent', border: 'none',
                      color: historyTab === 'approvals' ? 'var(--text0)' : 'var(--text1)',
                      borderBottom: historyTab === 'approvals' ? '2px solid var(--primary)' : '2px solid transparent',
                      fontWeight: historyTab === 'approvals' ? 600 : 400, cursor: 'pointer', fontSize: '12px',
                    }}
                  >Approvals</button>
                  <button
                    onClick={() => setHistoryTab('versions')}
                    style={{
                      flex: 1, padding: '7px 0', background: 'transparent', border: 'none',
                      color: historyTab === 'versions' ? 'var(--text0)' : 'var(--text1)',
                      borderBottom: historyTab === 'versions' ? '2px solid var(--primary)' : '2px solid transparent',
                      fontWeight: historyTab === 'versions' ? 600 : 400, cursor: 'pointer', fontSize: '12px',
                    }}
                  >Versions</button>
                </div>
              </div>
              <div className="history-list">
                {(() => {
                  // Sort newest first (already sorted from backend but ensure)
                  const sorted = [...versions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                  const pendingVersions = sorted.filter(v => v.status === 'PENDING');

                  const renderApprovalCard = (v, idx) => {
                    const vColor = onlineUsers.get(v.userId)?.color || '#6b7280';
                    return (
                      <div key={v.id} className="history-item" style={{ borderLeft: `3px solid ${vColor}` }}>
                        {/* File name — always prominent */}
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text0)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                          {v.fileName || '—'}
                        </div>
                        <div className="history-header">
                          <span className="history-user" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: vColor, flexShrink: 0 }} />
                            {v.username}
                          </span>
                          <span className="history-status" style={{
                            background: '#f97316',
                            color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                          }}>⏳ Pending</span>
                        </div>
                        <div className="history-time">{new Date(v.createdAt).toLocaleString()}</div>
                        <div className="history-actions" style={{ marginTop: '8px' }}>
                          <button className="history-btn revert" onClick={() => setViewCodeVersion(v)}>View Changes</button>
                          {isAdmin && (
                            <>
                              <button
                                className="history-btn review"
                                style={{ background: '#22c55e', color: '#fff' }}
                                onClick={() => approveVersion(v.id)}
                              ><CheckCircle2 size={12} /> Approve</button>
                              <button
                                className="history-btn no-change"
                                style={{ background: '#ef4444', color: '#fff' }}
                                onClick={() => { setRejectDialog({ versionId: v.id }); setRejectComment(''); }}
                              ><XCircle size={12} /> Reject</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  };

                  const renderVersionCard = (v, versionNumber) => {
                    const vColor = onlineUsers.get(v.userId)?.color || '#6b7280';
                    // Compute diff stats using adjacent version (next in sorted array = older)
                    const nextIdx = sorted.indexOf(v) + 1;
                    const olderVersion = nextIdx < sorted.length ? sorted[nextIdx] : null;
                    const diffStats = olderVersion
                      ? computeDiffStats(olderVersion.content, v.content)
                      : null;

                    return (
                      <div key={v.id} className="history-item" style={{ borderLeft: `3px solid ${vColor}`, position: 'relative' }}>
                        {/* Timeline dot */}
                        <div style={{
                          position: 'absolute', left: '-8px', top: '16px', width: '12px', height: '12px', borderRadius: '50%',
                          background: v.status === 'PENDING' ? '#f97316' : v.status === 'REVIEWED' ? '#22c55e' : '#ef4444',
                          border: '2px solid var(--bg1)', zIndex: 1
                        }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text0)' }}>Version {versionNumber}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text1)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                              {v.fileName || '—'}
                            </div>
                          </div>
                          <span className="history-status" style={{
                            background:
                              v.status === 'PENDING' ? '#f97316' :
                                v.status === 'REVIEWED' ? '#22c55e' : '#ef4444',
                            color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, flexShrink: 0,
                          }}>
                            {v.status === 'PENDING' ? '⏳ Pending' :
                              v.status === 'REVIEWED' ? '✅ Approved' : '❌ Rejected'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: vColor, flexShrink: 0 }} />
                          <span style={{ fontSize: '11px', color: 'var(--text1)' }}>{v.username}</span>
                        </div>
                        <div className="history-time">{new Date(v.createdAt).toLocaleString()}</div>

                        {/* Diff stats */}
                        {diffStats && (diffStats.added > 0 || diffStats.removed > 0) && (
                          <div style={{ fontSize: '11px', marginTop: '4px', display: 'flex', gap: '6px' }}>
                            {diffStats.added > 0 && <span style={{ color: '#22c55e', fontFamily: 'var(--font-mono)' }}>+{diffStats.added}</span>}
                            {diffStats.removed > 0 && <span style={{ color: '#ef4444', fontFamily: 'var(--font-mono)' }}>-{diffStats.removed}</span>}
                          </div>
                        )}

                        {v.reviewedBy && (
                          <div className="history-reviewer" style={{ marginTop: '4px' }}>
                            Reviewed by {v.reviewedBy}
                            {v.reviewedAt && <> · {new Date(v.reviewedAt).toLocaleDateString()}</>}
                          </div>
                        )}
                        {v.reviewComment && (
                          <div style={{ fontSize: 11, color: '#ef4444', fontStyle: 'italic', marginTop: '2px' }}>
                            "{v.reviewComment}"
                          </div>
                        )}

                        <div className="history-actions" style={{ marginTop: '6px' }}>
                          <button className="history-btn revert" onClick={() => setViewCodeVersion(v)}>View Changes</button>
                          {isAdmin && v.status === 'REVIEWED' && (
                            <button className="history-btn revert" onClick={() => revertToVersion(v.id)}>Revert</button>
                          )}
                        </div>
                      </div>
                    );
                  };

                  // Version numbers are assigned newest=highest, oldest=1
                  const totalVersions = sorted.length;

                  return (
                    <>
                      {historyTab === 'approvals' && (
                        pendingVersions.length === 0
                          ? <div style={{ padding: '16px 12px', color: 'var(--text2)', fontSize: '12px', textAlign: 'center' }}>✓ No pending approvals</div>
                          : pendingVersions.map((v, i) => renderApprovalCard(v, i))
                      )}
                      {historyTab === 'versions' && (
                        sorted.length === 0
                          ? <div style={{ padding: '16px 12px', color: 'var(--text2)', fontSize: '12px', textAlign: 'center' }}>No versions yet</div>
                          : sorted.map((v, i) => renderVersionCard(v, totalVersions - i))
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Reject dialog */}
              {rejectDialog && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
                }}>
                  <div style={{
                    background: 'var(--surface2)', borderRadius: 10, padding: 20, width: 320,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}>
                    <h3 style={{ margin: '0 0 12px', color: 'var(--text0)', fontSize: 16 }}>Reject Version</h3>
                    <p style={{ margin: '0 0 10px', color: 'var(--text1)', fontSize: 13 }}>Add an optional rejection reason:</p>
                    <textarea
                      value={rejectComment}
                      onChange={e => setRejectComment(e.target.value)}
                      placeholder="e.g. Please handle null inputs before resubmitting..."
                      rows={4}
                      style={{
                        width: '100%', background: 'var(--surface1)', border: '1px solid var(--border)',
                        color: 'var(--text0)', borderRadius: 6, padding: 8, fontSize: 13, resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setRejectDialog(null); setRejectComment(''); }}
                        style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text1)', cursor: 'pointer' }}
                      >Cancel</button>
                      <button
                        onClick={() => rejectVersion(rejectDialog.versionId, rejectComment)}
                        style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                      >Confirm Reject</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* People tab */}
            <div className={sideTab === 'people' ? '' : 'hide'}>
              <Participants
                participants={participants}
                roomId={roomId}
                currentUserId={user.id}
                onlineUsers={onlineUsers}
                inviteCode={inviteCode}
              />
            </div>
          </div>
        </aside>

        {/* Sidebar Drag Handle */}
        <div className="drag-handle" onPointerDown={startSidebarDrag} />

        <main className="editor-main">
          {activeFile ? (
            <>
              <div className="tab-bar">
                <div className="editor-tab active">
                  <span className="editor-tab-name">{activeFile.name}</span>
                  {isDirty && <span className="dirty-dot" />}
                  <button className="tab-download-btn" title="Download file" onClick={downloadActiveFile}>
                    <Download size={12} />
                  </button>
                </div>
                {typingText && (
                  <div className="typing-indicator">{typingText}</div>
                )}
              </div>
              <div className="editor-wrapper" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {!yjsProvider ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    Connecting to collaborative session...
                  </div>
                ) : (
                  <CodeEditor
                    content={code}
                    ytext={yjsProvider.ytext}
                    awareness={yjsProvider.awareness}
                    language={activeFile.language}
                    onChange={handleCodeChange}
                    readOnly={false}
                  />
                )}
              </div>
            </>
          ) : (
            <div
              className={`empty-editor dropzone ${isDragOver ? 'drag-active' : ''}`}
              onDragOver={handleDropzoneDragOver}
              onDragLeave={handleDropzoneDragLeave}
              onDrop={handleDropzoneDrop}
            >
              {uploadProgress ? (
                /* ── Upload progress view ── */
                <div className="upload-progress-wrap">
                  <div className="upload-progress-icon">
                    <Upload size={32} className="upload-spin-icon" />
                  </div>
                  <p className="upload-progress-label">{uploadProgress.label}</p>
                  <div className="upload-progress-bar-track">
                    <div
                      className="upload-progress-bar-fill"
                      style={{ width: uploadProgress.total ? `${(uploadProgress.done / uploadProgress.total) * 100}%` : '5%' }}
                    />
                  </div>
                  <p className="upload-progress-count">
                    {uploadProgress.done} / {uploadProgress.total} files
                  </p>
                </div>
              ) : isDragOver ? (
                /* ── Drag over view ── */
                <div className="dropzone-drag-hint">
                  <FolderUp size={48} className="empty-icon" style={{ color: 'var(--accent)' }} />
                  <p className="empty-title" style={{ color: 'var(--accent)' }}>Drop to upload</p>
                  <p className="empty-sub">Files or entire folders</p>
                </div>
              ) : (
                /* ── Default empty state ── */
                <>
                  <FileCode size={48} className="empty-icon" />
                  <p className="empty-title">No file open</p>
                  <p className="empty-sub">Select a file from the explorer, or drop files &amp; folders here</p>
                  <div className="empty-actions">
                    <button className="btn-primary" onClick={() => setModal({ type: 'FILE', parentId: null })}>
                      <FileCode size={14} /> New File
                    </button>
                    <button className="btn-ghost" onClick={() => fileInputRef.current.click()}>
                      <Upload size={14} /> Upload Files
                    </button>
                    <button className="btn-ghost" onClick={() => folderInputRef.current.click()}>
                      <FolderUp size={14} /> Upload Folder
                    </button>
                  </div>
                  <div className="dropzone-hint">
                    <span>or drag &amp; drop anywhere in this area</span>
                  </div>
                </>
              )}
            </div>
          )}
        </main>

        {/* AI Panel: drag handle + panel, only rendered when open */}
        {showAiPanel && (
          <>
            <div className="drag-handle" onPointerDown={startAiDrag} />
            <AiPanel
              code={code}
              language={activeFile ? activeFile.language : 'plaintext'}
              filename={activeFile ? activeFile.name : ''}
              roomId={roomId}
              fileNodeId={activeFile ? activeFile.id : undefined}
              activeFileVersion={activeFile ? activeFile.version : undefined}
              tree={tree}
              onInsertCode={handleInsertAiCode}
              onClose={() => setShowAiPanel(false)}
              onFileCreated={async (fileId, fileName) => {
                // Refresh the file tree so the new file appears immediately
                await loadTree();
              }}
              onCodeUpdated={(fileId, newContent) => {
                // If the updated file is the active one, push the new content to the editor
                if (activeFile?.id === fileId) {
                  setCode(newContent);
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
