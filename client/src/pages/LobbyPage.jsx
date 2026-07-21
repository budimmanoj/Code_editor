import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './LobbyPage.css';

export default function LobbyPage({ user, onEnterRoom, onLogout }) {
  const [roomName,   setRoomName]   = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState('');
  const [profile,    setProfile]    = useState(null);
  const [tab,        setTab]        = useState('lobby'); // 'lobby' | 'profile'

  useEffect(() => {
    if (tab === 'profile') {
      api.getMyProfile().then(setProfile).catch(() => {});
    }
  }, [tab]);

  async function createRoom(e) {
    e.preventDefault();
    if (!roomName.trim()) return;
    setError(''); setLoading('create');
    try {
      const room = await api.createRoom({ name: roomName.trim() });
      onEnterRoom(room.id, room.name, 'ADMIN');
    } catch (err) { setError(err.message); }
    finally { setLoading(''); }
  }

  async function joinRoom(e) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setError(''); setLoading('join');
    try {
      const room = await api.joinRoom(inviteCode.trim().toUpperCase());
      const { role } = await api.getMyRole(room.id);
      onEnterRoom(room.id, room.name, role);
    } catch (err) { setError(err.message); }
    finally { setLoading(''); }
  }

  async function enterExistingRoom(roomId, roomName) {
    try {
      const { role } = await api.getMyRole(roomId);
      onEnterRoom(roomId, roomName, role);
    } catch (err) { setError(err.message); }
  }

  const initials = (user.username || user.email || '?').slice(0, 2).toUpperCase();

  return (
    <div className="lobby-bg">
      <div className="lobby-glow" />

      <div className="lobby-card">
        {/* Header */}
        <div className="lobby-header">
          <div className="lobby-logo">
            <span className="lobby-dot" />
            CodeRoom
          </div>
          <div className="lobby-user">
            <div className="user-avatar">{initials}</div>
            <span className="user-name">{user.username || user.email}</span>
            <button className="lobby-tab-btn" style={{ marginLeft: 8 }}
              onClick={() => setTab(tab === 'profile' ? 'lobby' : 'profile')}>
              {tab === 'profile' ? '← Back' : 'Profile'}
            </button>
            <button className="logout-btn" onClick={onLogout}>logout</button>
          </div>
        </div>

        {error && <div className="lobby-error">{error}</div>}

        {tab === 'lobby' ? (
          <>
            <h1 className="lobby-title">Your Workspace</h1>

            <div className="lobby-grid">
              {/* Create room */}
              <div className="lobby-pane">
                <div className="lobby-pane-label">New Room</div>
                <p className="lobby-pane-desc">Start a session — you become admin</p>
                <form onSubmit={createRoom}>
                  <div style={{ marginBottom: 14 }}>
                    <label className="label">Room Name</label>
                    <input className="input-field" placeholder="my-project"
                      value={roomName} onChange={(e) => setRoomName(e.target.value)} required />
                  </div>
                  <button className="btn-primary lobby-btn" type="submit" disabled={loading === 'create'}>
                    {loading === 'create' ? 'Creating...' : '+ Create Room'}
                  </button>
                </form>
              </div>

              {/* Join room */}
              <div className="lobby-pane">
                <div className="lobby-pane-label">Join Room</div>
                <p className="lobby-pane-desc">Enter an 8-character invite code</p>
                <form onSubmit={joinRoom}>
                  <div style={{ marginBottom: 14 }}>
                    <label className="label">Invite Code</label>
                    <input className="input-field" placeholder="ABCD1234"
                      value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
                      maxLength={8} style={{ textTransform: 'uppercase', letterSpacing: 3 }} required />
                  </div>
                  <button className="btn-ghost lobby-btn" type="submit" disabled={loading === 'join'}>
                    {loading === 'join' ? 'Joining...' : '→ Join Room'}
                  </button>
                </form>
              </div>
            </div>

            <div className="lobby-hint">
              💡 Share the 8-char invite code with teammates so they can join
            </div>
          </>
        ) : (
          <ProfilePanel profile={profile} onEnterRoom={enterExistingRoom} />
        )}
      </div>
    </div>
  );
}

function ProfilePanel({ profile, onEnterRoom }) {
  if (!profile) return <div style={{ color: 'var(--text-muted)', padding: 24 }}>Loading profile…</div>;

  return (
    <div>
      <h2 style={{ color: 'var(--text)', marginBottom: 24 }}>
        👤 {profile.username} <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{profile.email}</span>
      </h2>

      <RoomList title="🛡 Rooms I Created (Admin)" rooms={profile.roomsCreated} onEnter={onEnterRoom} badgeColor="#7c3aed" />
      <RoomList title="👥 Rooms I'm a Member Of" rooms={profile.roomsJoined} onEnter={onEnterRoom} badgeColor="#0891b2" />
    </div>
  );
}

function RoomList({ title, rooms, onEnter, badgeColor }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{title}</div>
      {rooms.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>None yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rooms.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--surface)', borderRadius: 8, padding: '10px 14px',
              border: '1px solid var(--border)'
            }}>
              <div>
                <span style={{ color: 'var(--text)', fontWeight: 600, marginRight: 10 }}>{r.name}</span>
                <code style={{ background: 'var(--bg)', color: badgeColor, fontSize: 12,
                  padding: '2px 6px', borderRadius: 4, letterSpacing: 2 }}>{r.inviteCode}</code>
                <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 10 }}>
                  {r.participantCount} member{r.participantCount !== 1 ? 's' : ''}
                </span>
              </div>
              <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 13 }}
                onClick={() => onEnter(r.id, r.name)}>
                Enter →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
