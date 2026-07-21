import React from 'react';
import './Participants.css';

const ROLE_COLORS = {
  ADMIN: { bg: '#7c3aed22', color: '#a78bfa', label: 'Admin' },
  USER:  { bg: '#0891b222', color: '#38bdf8', label: 'Member' },
};

export default function Participants({ participants, currentUserId }) {
  if (!participants || participants.length === 0) {
    return <div className="participants-empty">No participants yet</div>;
  }

  const admins  = participants.filter(p => p.role === 'ADMIN');
  const members = participants.filter(p => p.role === 'USER');

  return (
    <div className="participants-list">
      <div className="participants-header">
        <span className="participants-title">Participants</span>
        <span className="participants-count">{participants.length}</span>
      </div>

      {admins.length > 0 && (
        <>
          <div className="participants-group-label">🛡 Admin</div>
          {admins.map(p => <ParticipantRow key={p.userId} p={p} isMe={p.userId === currentUserId} />)}
        </>
      )}

      {members.length > 0 && (
        <>
          <div className="participants-group-label">👥 Members</div>
          {members.map(p => <ParticipantRow key={p.userId} p={p} isMe={p.userId === currentUserId} />)}
        </>
      )}
    </div>
  );
}

function ParticipantRow({ p, isMe }) {
  const roleStyle = ROLE_COLORS[p.role] || ROLE_COLORS.USER;
  const initials = (p.candidateName || p.email || '?').slice(0, 2).toUpperCase();

  return (
    <div className={`participant-item ${isMe ? 'me' : ''}`}>
      <div className="participant-avatar">{initials}</div>
      <div className="participant-info">
        <span className="participant-name">
          {p.candidateName || p.email}
          {isMe && <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 5 }}>(you)</span>}
        </span>
        <span className="participant-email">{p.email}</span>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
        padding: '2px 6px', borderRadius: 4, background: roleStyle.bg, color: roleStyle.color
      }}>{roleStyle.label}</span>
    </div>
  );
}
