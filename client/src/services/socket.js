import { io } from 'socket.io-client';

const runtimeApiUrl =
  typeof window !== 'undefined' &&
  window.__PATHGUARD_CONFIG__ &&
  window.__PATHGUARD_CONFIG__.apiUrl;
const serverUrl = runtimeApiUrl || import.meta.env.VITE_API_URL || '';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(serverUrl, {
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
  }
  return socket;
}

export function connectSocket() {
  getSocket().connect();
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
