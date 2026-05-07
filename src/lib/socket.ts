import io from "socket.io-client";

let socket: any = null;

export function getSocket(token?: string | null) {
  if (!socket) {
    socket = io({
      path: "/realtime",
      transports: ["polling"],
      auth: {
        token: token || "",
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }

  return socket;
}

export function connectSocket(token?: string | null) {
  return getSocket(token);
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default getSocket;