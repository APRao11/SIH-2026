import { io } from 'socket.io-client'

const socket = io({
  path: '/socket.io',
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  timeout: 10000,
})

export function connectSocket() {
  if (socket.disconnected) socket.connect()
  return socket
}

export function joinEmergency(emergencyId) {
  connectSocket()
  socket.emit('joinEmergency', emergencyId)
}

export function leaveEmergency(emergencyId) {
  if (socket.connected) socket.emit('leaveEmergency', emergencyId)
}

export function joinResponder(responderId) {
  connectSocket()
  socket.emit('joinResponder', responderId)
}

export function leaveResponder(responderId) {
  if (socket.connected) socket.emit('leaveResponder', responderId)
}

export default socket