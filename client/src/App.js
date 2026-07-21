import React, { useState, useEffect } from 'react';
import './index.css';
import AuthPage    from './pages/AuthPage';
import LobbyPage   from './pages/LobbyPage';
import EditorPage  from './pages/EditorPage';
import { tokenStore } from './api/client';

const USER_KEY = 'coderoom_user';

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  });
  // room = { id, name, role }
  const [room, setRoom] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('coderoom_room')); } catch { return null; }
  });

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else       localStorage.removeItem(USER_KEY);
  }, [user]);

  useEffect(() => {
    if (room) sessionStorage.setItem('coderoom_room', JSON.stringify(room));
    else      sessionStorage.removeItem('coderoom_room');
  }, [room]);

  function handleLogin(authResp) {
    const { token, ...userData } = authResp;
    tokenStore.set(token);
    setUser(userData);
  }

  function handleLogout() {
    tokenStore.clear();
    setUser(null);
    setRoom(null);
  }

  function handleEnterRoom(id, name, role) {
    setRoom({ id, name, role });
  }

  function handleLeaveRoom() {
    setRoom(null);
  }

  if (!user) return <AuthPage onLogin={handleLogin} />;
  if (!room)  return <LobbyPage user={user} onEnterRoom={handleEnterRoom} onLogout={handleLogout} />;
  return (
    <EditorPage
      user={user}
      roomId={room.id}
      roomName={room.name}
      userRole={room.role}
      onLeave={handleLeaveRoom}
    />
  );
}
