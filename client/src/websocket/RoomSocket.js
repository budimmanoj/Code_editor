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
 * Events:
 * connected
 * disconnected
 * PRESENCE_INIT
 * USER_JOINED
 * USER_LEFT
 * CODE_UPDATE
 * CURSOR_UPDATE
 * TYPING
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
    this.maxReconnectDelay = 30000;
  }

  connect() {
    // Don't create another connection if one already exists.
    if (
      this.ws &&
      (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      )
    ) {
      console.log('[WS] Connection already active');
      return;
    }

    this.shouldReconnect = true;

    const url =
      `${WS_BASE}/ws/room/${this.roomId}?token=${this.token}`;

    console.log('[WS] Connecting to room', this.roomId);

    let socket;

    try {
      socket = new WebSocket(url);
    } catch (err) {
      console.error('[WS] Failed to create WebSocket:', err);
      this._scheduleReconnect();
      return;
    }

    // IMPORTANT:
    // Store this exact socket instance.
    this.ws = socket;

    socket.onopen = () => {
      // Ignore stale socket events.
      if (this.ws !== socket) {
        socket.close();
        return;
      }

      console.log('[WS] Connected to room', this.roomId);

      this.reconnectDelay = 3000;

      this._emit('connected');
    };

    socket.onmessage = (event) => {
      // Ignore messages from an old socket.
      if (this.ws !== socket) {
        return;
      }

      try {
        const msg = JSON.parse(event.data);

        this._emit(msg.type, msg);
        this._emit('message', msg);
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    socket.onerror = (err) => {
      // Ignore errors from stale sockets.
      if (this.ws !== socket) {
        return;
      }

      console.error('[WS] Error:', err);
    };

    socket.onclose = (event) => {
      // Ignore close events from an old socket.
      if (this.ws !== socket) {
        return;
      }

      console.log(
        '[WS] Disconnected:',
        event.code,
        event.reason || '(no reason)'
      );

      this.ws = null;

      this._emit('disconnected', event);

      if (this.shouldReconnect) {
        this._scheduleReconnect();
      }
    };
  }

  _scheduleReconnect() {
    if (!this.shouldReconnect) {
      return;
    }

    if (this.reconnectTimer) {
      return;
    }

    console.log(
      `[WS] Reconnecting in ${this.reconnectDelay / 1000}s...`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;

      if (this.shouldReconnect) {
        this.connect();
      }
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(
      this.reconnectDelay * 1.5,
      this.maxReconnectDelay
    );
  }

  on(event, handler) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }

    this.handlers[event].push(handler);

    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (!this.handlers[event]) {
      return;
    }

    this.handlers[event] =
      this.handlers[event].filter(h => h !== handler);
  }

  _emit(event, data) {
    const handlers = this.handlers[event] || [];

    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        console.error('[WS] Handler error:', err);
      }
    });
  }

  send(data) {
    if (
      this.ws &&
      this.ws.readyState === WebSocket.OPEN
    ) {
      this.ws.send(JSON.stringify(data));
      return true;
    }

    console.warn('[WS] Cannot send — socket is not connected');

    return false;
  }

  sendCodeUpdate(fileId, content) {
    return this.send({
      type: 'CODE_UPDATE',
      fileId,
      content
    });
  }

  sendCursorUpdate(fileId, line, col) {
    return this.send({
      type: 'CURSOR_UPDATE',
      fileId,
      line,
      col
    });
  }

  sendTyping(fileId, typing) {
    return this.send({
      type: 'TYPING',
      fileId,
      typing
    });
  }

  disconnect() {
    console.log('[WS] Intentional disconnect');

    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const socket = this.ws;

    if (!socket) {
      return;
    }

    // Detach current socket immediately.
    this.ws = null;

    // Prevent old socket events from doing anything.
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;

    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close(1000, 'Client disconnecting');
    }
  }

  get isConnected() {
    return !!(
      this.ws &&
      this.ws.readyState === WebSocket.OPEN
    );
  }
}
