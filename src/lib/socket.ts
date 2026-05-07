import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

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

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default getSocket;