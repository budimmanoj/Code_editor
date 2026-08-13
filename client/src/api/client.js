const BASE =
  `${process.env.REACT_APP_API_URL || 'http://localhost:8080'}/api`;

export const WS_BASE =
  process.env.REACT_APP_WS_URL || 'ws://localhost:8080';
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
  verifyRegistration: (dto) => req('POST', '/users/register/verify', dto),
  resendRegistrationOtp: (email) => req('POST', '/users/register/resend', { email }),
  login:    (email, pass) => req('POST', '/users/login', { email, password: pass }),
  
  forgotPassword: (email) => req('POST', '/users/forgot-password', { email }),
  verifyForgotPasswordOtp: (dto) => req('POST', '/users/forgot-password/verify', dto),
  
  // Custom req with reset token header for resetPassword
  resetPassword: async (token, dto) => {
    const res = await fetch(`${BASE}/users/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(dto)
    });
    const data = await (res.headers.get('content-type')?.includes('application/json') ? res.json() : res.text());
    if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
    return data;
  },

  changePassword: (dto) => req('POST', '/users/change-password', dto),
  sendChangePasswordOtp: () => req('POST', '/users/change-password/send-otp', {}),
  changePasswordWithOtp: (dto) => req('POST', '/users/change-password/verify-otp', dto),

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
  updateCode:          (dto)                            => req('POST', `/code/update`, dto),
  getFileVersions:     (roomId, fileNodeId)             => req('GET',  `/code/versions/${roomId}/${fileNodeId}`),
  getRoomVersions:     (roomId)                         => req('GET',  `/code/versions/room/${roomId}`),
  getHistory:          (roomId, scopeType, scopeId)     => req('GET',  `/code/history/${roomId}?scopeType=${scopeType}&scopeId=${scopeId}`),
  getPendingVersions:  (roomId)                         => req('GET',  `/code/pending/${roomId}`),
  approveVersion:      (roomId, versionId)              => req('PUT',  `/code/versions/${roomId}/${versionId}/approve`),
  rejectVersion:       (roomId, versionId, comment)     => req('POST', `/code/versions/${roomId}/${versionId}/reject`, { comment }),
  updateVersionStatus: (roomId, versionId, status)      => req('PUT',  `/code/versions/${roomId}/${versionId}/status?status=${status}`),
  revertToVersion:     (roomId, fileNodeId, versionId)  => req('POST', `/code/versions/${roomId}/${fileNodeId}/revert/${versionId}`, {}),

  // AI — single generic call; action maps to POST /api/ai/{action}
  // Valid actions: review, explain, refactor, debug, generate, tests,
  //   commit-message, security, optimize, docs, chat, review-before-commit
  aiCall: (action, dto) => req('POST', `/ai/${action}`, dto),

  // AI Workspace Action — execute a confirmed AI action (CREATE_FILE, UPDATE_FILE)
  aiWorkspaceAction: (action, roomId) => req('POST', '/ai/workspace-action', { action, roomId }),
};
