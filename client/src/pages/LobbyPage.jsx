import React, { useState, useEffect } from 'react';
import { User, LogOut, ArrowLeft, Shield, Users, Lightbulb, Code2 } from 'lucide-react';
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
            <Code2 size={20} />
            CodeRoom
          </div>
          <div className="lobby-user">
            <div className="user-avatar">{initials}</div>
            <span className="user-name">{user.username || user.email}</span>
            <button className="lobby-tab-btn" onClick={() => setTab(tab === 'profile' ? 'lobby' : 'profile')}>
              {tab === 'profile' ? <><ArrowLeft size={16} /> Back</> : <><User size={16} /> Profile</>}
            </button>
            <button className="logout-btn" onClick={onLogout}>
              <LogOut size={16} />
              Logout
            </button>
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
              <Lightbulb size={16} />
              Share the 8-char invite code with teammates so they can join
            </div>
          </>
        ) : (
          <ProfilePanel user={user} profile={profile} onEnterRoom={enterExistingRoom} />
        )}
      </div>
    </div>
  );
}

function ProfilePanel({ user, profile, onEnterRoom }) {
  return (
    <div>
      <div className="profile-header">
        <User size={32} color="var(--accent)" />
        <div>
          <div className="lobby-title" style={{ marginBottom: 4 }}>{user.username || user.email}</div>
          <div className="profile-email">{user.email}</div>
        </div>
      </div>

      {!profile ? (
        <div style={{ color: 'var(--text2)', padding: '24px 0', fontSize: 13 }}>Loading workspace history...</div>
      ) : (
        <>
          <RoomList title="Rooms I Created (Admin)" icon={<Shield size={16} />} rooms={profile.roomsCreated} onEnter={onEnterRoom} />
          <RoomList title="Rooms I'm a Member Of" icon={<Users size={16} />} rooms={profile.roomsJoined} onEnter={onEnterRoom} />
        </>
      )}
    </div>
  );
}

function RoomList({ title, icon, rooms, onEnter }) {
  return (
    <div className="room-list-group">
      <div className="room-list-title">
        {icon}
        {title}
      </div>
      {rooms.length === 0 ? (
        <div className="room-list-empty">None yet</div>
      ) : (
        <div className="room-list-container">
          {rooms.map(r => (
            <div key={r.id} className="room-row">
              <div className="room-row-left">
                <span className="room-name">{r.name}</span>
                <span className="room-code">{r.inviteCode}</span>
                <span className="room-members">
                  <Users size={14} />
                  {r.participantCount} member{r.participantCount !== 1 ? 's' : ''}
                </span>
              </div>
              <button className="btn-ghost" onClick={() => onEnter(r.id, r.name)}>
                Enter →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
