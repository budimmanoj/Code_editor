import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';

/**
 * Custom Yjs Provider for CodeRoom WebSocket.
 * Synchronizes a Y.Doc and Awareness state over the existing WebSocket connection.
 */
export class CodeRoomYjsProvider {
  constructor(wsSendFn, roomId, fileId, username, color, initialContent) {
    this.wsSendFn = wsSendFn;
    this.roomId = roomId;
    this.fileId = fileId;
    this.initialContent = initialContent;
    this.doc = new Y.Doc();
    this.ytext = this.doc.getText('coderoom-text');
    
    // We do NOT initialize content here anymore. We wait for YJS_STATE_RESPONSE.
    
    this.awareness = new Awareness(this.doc);

    // Set local awareness state
    this.awareness.setLocalStateField('user', {
      name: username,
      color: color,
    });

    // Listen to local Yjs document changes and broadcast them
    this.onUpdate = (update, origin) => {
      if (origin === 'remote') return;
      this.wsSendFn({
        type: 'YJS_UPDATE',
        fileId: this.fileId,
        update: Array.from(update), // Convert Uint8Array to normal array for JSON
      });
    };
    this.doc.on('update', this.onUpdate);

    // Listen to local Awareness changes and broadcast them
    this.onAwarenessUpdate = ({ added, updated, removed }) => {
      const changedClients = added.concat(updated, removed);
      const encoded = encodeAwarenessUpdate(this.awareness, changedClients);
      this.wsSendFn({
        type: 'YJS_AWARENESS',
        fileId: this.fileId,
        update: Array.from(encoded),
      });
    };
    this.awareness.on('update', this.onAwarenessUpdate);

    // Request state from server
    this.wsSendFn({
      type: 'YJS_REQUEST_STATE',
      fileId: this.fileId,
    });
  }

  handleStateResponse(updates) {
    if (updates && updates.length > 0) {
      this.doc.transact(() => {
        updates.forEach(updateArray => {
          const update = new Uint8Array(updateArray);
          Y.applyUpdate(this.doc, update);
        });
      }, 'remote');
    } else if (this.initialContent && this.ytext.toString() === '') {
      this.ytext.insert(0, this.initialContent);
    }
  }

  /**
   * Called when a YJS_UPDATE message is received from the WebSocket.
   */
  handleUpdate(updateArray) {
    const update = new Uint8Array(updateArray);
    Y.applyUpdate(this.doc, update, 'remote');
  }

  /**
   * Called when a YJS_AWARENESS message is received from the WebSocket.
   */
  handleAwareness(updateArray) {
    const update = new Uint8Array(updateArray);
    applyAwarenessUpdate(this.awareness, update, this);
  }

  destroy() {
    this.doc.off('update', this.onUpdate);
    this.awareness.off('update', this.onAwarenessUpdate);
    this.awareness.destroy();
    this.doc.destroy();
  }
}
