import React from 'react';
import './Participants.css';

const ROLE_COLORS = {
  ADMIN: { bg: '#7c3aed22', color: '#a78bfa', label: 'Admin' },
  USER:  { bg: '#0891b222', color: '#38bdf8', label: 'Member' },
};

/**
 * Participants panel — shows room members with live online/offline status.
 *
 * Props:
 *   participants  — array of ParticipantInfoDto from REST
 *   currentUserId — UUID string of the logged-in user
 *   onlineUsers   — Map<userId, {userId, username, color}> from WebSocket presence
 */
export default function Participants({ participants, currentUserId, onlineUsers = new Map() }) {
  if (!participants || participants.length === 0) {
    return (
      <div className="participants-empty">
        <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
        No participants yet
      </div>
    );
  }

  const admins  = participants.filter(p => p.role === 'ADMIN');
  const members = participants.filter(p => p.role === 'USER');
  const onlineCount = onlineUsers.size;

  return (
    <div className="participants-list">
      <div className="participants-header">
        <span className="participants-title">Participants</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onlineCount > 0 && (
            <span style={{
              fontSize: 10, color: '#3fb950', fontWeight: 600,
              background: '#3fb95018', padding: '1px 6px', borderRadius: 10,
            }}>
              {onlineCount} live
            </span>
          )}
          <span className="participants-count">{participants.length}</span>
        </div>
      </div>

      {admins.length > 0 && (
        <>
          <div className="participants-group-label">🛡 Admin</div>
          {admins.map(p => (
            <ParticipantRow
              key={p.userId}
              p={p}
              isMe={String(p.userId) === String(currentUserId)}
              onlineInfo={onlineUsers.get(String(p.userId))}
            />
          ))}
        </>
      )}

      {members.length > 0 && (
        <>
          <div className="participants-group-label">👥 Members</div>
          {members.map(p => (
            <ParticipantRow
              key={p.userId}
              p={p}
              isMe={String(p.userId) === String(currentUserId)}
              onlineInfo={onlineUsers.get(String(p.userId))}
            />
          ))}
        </>
      )}
    </div>
  );
}

function ParticipantRow({ p, isMe, onlineInfo }) {
  const roleStyle = ROLE_COLORS[p.role] || ROLE_COLORS.USER;
  const initials  = (p.candidateName || p.email || '?').slice(0, 2).toUpperCase();
  const isOnline  = !!onlineInfo;
  const cursorColor = onlineInfo?.color;

  return (
    <div className={`participant-item ${isMe ? 'me' : ''}`}>
      {/* Avatar with online dot */}
      <div className="participant-avatar-wrap">
        <div
          className="participant-avatar"
          style={cursorColor ? { borderColor: cursorColor, borderWidth: 2, borderStyle: 'solid' } : {}}
        >
          {initials}
        </div>
        <span className={`presence-dot ${isOnline ? 'online' : 'offline'}`} />
      </div>

      <div className="participant-info">
        <span className="participant-name">
          {p.candidateName || p.email}
          {isMe && <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 5 }}>(you)</span>}
        </span>
        <span className="participant-email">{p.email}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {cursorColor && (
          <span
            title="Cursor color"
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: cursorColor, flexShrink: 0,
            }}
          />
        )}
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
          padding: '2px 6px', borderRadius: 4,
          background: roleStyle.bg, color: roleStyle.color, whiteSpace: 'nowrap',
        }}>
          {roleStyle.label}
        </span>
      </div>
    </div>
  );
}
