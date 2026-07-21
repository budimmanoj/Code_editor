const BASE = 'http://localhost:8080/api';

/** WebSocket base URL — used by RoomSocket.js */
export const WS_BASE = 'ws://localhost:8080';

// ── Token storage ─────────────────────────────────────────────────────────────
const TOKEN_KEY = 'coderoom_token';

export const tokenStore = {
  get: ()      => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: ()    => localStorage.removeItem(TOKEN_KEY),
};

// ── Core request helper ───────────────────────────────────────────────────────
async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    tokenStore.clear();
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }

  if (res.status === 204) return null; // No Content

  const contentType = res.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
    if (!res.ok) throw new Error(data || 'Request failed');
    return data;
  }

  if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
  return data;
}

// ── API surface ───────────────────────────────────────────────────────────────
export const api = {
  // Auth
  register: (dto)         => req('POST', '/users/register', dto),
  login:    (email, pass) => req('POST', '/users/login', { email, password: pass }),
  getMyProfile: ()        => req('GET',  '/users/me'),

  // Rooms
  createRoom:  (dto)        => req('POST', '/rooms/create', dto),
  joinRoom:    (inviteCode) => req('POST', '/rooms/join', { inviteCode }),
  getMyRole:   (roomId)     => req('GET',  `/rooms/${roomId}/myRole`),

  // Workspace
  getFileTree:         (roomId)                     => req('GET',    `/workspace/${roomId}/fileTree`),
  getFile:             (roomId, fileNodeId)          => req('GET',    `/workspace/${roomId}/fileNode/${fileNodeId}`),
  getRoomParticipants: (roomId)                     => req('GET',    `/workspace/${roomId}/roomParticipants`),
  createFileNode:      (dto)                        => req('POST',   '/workspace/fileNode', dto),
  deleteFileNode:      (roomId, fileNodeId)          => req('DELETE', `/workspace/${roomId}/fileNode/${fileNodeId}`),
  renameFileNode:      (roomId, fileNodeId, name)    => req('PATCH',  `/workspace/${roomId}/fileNode/${fileNodeId}/rename`, { name }),

  // Code & Versions
  updateCode:          (dto)                            => req('PUT',  '/code/update', dto),
  getFileVersions:     (roomId, fileNodeId)             => req('GET',  `/code/versions/${roomId}/${fileNodeId}`),
  updateVersionStatus: (roomId, versionId, status)      => req('PUT',  `/code/versions/${roomId}/${versionId}/status?status=${status}`),
  revertToVersion:     (roomId, fileNodeId, versionId)  => req('POST', `/code/versions/${roomId}/${fileNodeId}/revert/${versionId}`, {}),

  // AI — single generic call; action maps to POST /api/ai/{action}
  // Valid actions: review, explain, refactor, debug, generate, tests,
  //   commit-message, security, optimize, docs, chat, review-before-commit
  aiCall: (action, dto) => req('POST', `/ai/${action}`, dto),
};
