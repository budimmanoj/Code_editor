import { WS_BASE } from '../api/client';

/**
 * WebSocket client for a room session.
 *
 * Usage:
 *   const socket = new RoomSocket(roomId, token);
 *   socket.on('USER_JOINED', handler);
 *   socket.on('CODE_UPDATE', handler);
 *   socket.connect();
 *   // later:
 *   socket.sendCodeUpdate(fileId, content);
 *   socket.disconnect();
 *
 * Events emitted:
 *   connected, disconnected,
 *   PRESENCE_INIT, USER_JOINED, USER_LEFT,
 *   CODE_UPDATE, CURSOR_UPDATE, TYPING
 */
export class RoomSocket {
  constructor(roomId, token) {
    this.roomId = roomId;
    this.token = token;
    this.ws = null;
    this.handlers = {};
    this.reconnectTimer = null;
    this.shouldReconnect = true;
    this.reconnectDelay = 3000;
  }

  connect() {
    const url = `${WS_BASE}/ws/room/${this.roomId}?token=${this.token}`;
    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.error('[WS] Failed to create WebSocket:', err);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[WS] Connected to room', this.roomId);
      this.reconnectDelay = 3000; // reset backoff
      this._emit('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._emit(msg.type, msg);
        this._emit('message', msg);
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    this.ws.onclose = (event) => {
      console.log('[WS] Disconnected:', event.code, event.reason);
      this._emit('disconnected');
      if (this.shouldReconnect) {
        this._scheduleReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect) {
        console.log('[WS] Reconnecting...');
        this.connect();
      }
    }, this.reconnectDelay);
    // Exponential backoff up to 30s
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
  }

  /** Register an event handler. Returns an unsubscribe function. */
  on(event, handler) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  }

  _emit(event, data) {
    (this.handlers[event] || []).forEach(h => {
      try { h(data); } catch (e) { console.error('[WS] Handler error:', e); }
    });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  sendCodeUpdate(fileId, content) {
    this.send({ type: 'CODE_UPDATE', fileId, content });
  }

  sendCursorUpdate(fileId, line, col) {
    this.send({ type: 'CURSOR_UPDATE', fileId, line, col });
  }

  sendTyping(fileId, typing) {
    this.send({ type: 'TYPING', fileId, typing });
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
  }

  get isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}
