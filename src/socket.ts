import type {Server as HttpServer} from 'http';
import {Server as SocketIOServer} from 'socket.io';
import type {Order, DrinkOption} from './types';

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {origin: '*'},
  });

  io.on('connection', socket => {
    console.log(`[socket] cliente conectado: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[socket] cliente desconectado: ${socket.id}`);
    });
  });

  return io;
}

function emit(event: string, payload: unknown) {
  if (!io) {
    return;
  }
  io.emit(event, payload);
}

export const events = {
  orderCreated: (order: Order) => emit('order:created', order),
  orderUpdated: (order: Order) => emit('order:updated', order),
  orderDeleted: (orderId: string) => emit('order:deleted', {id: orderId}),
  drinkCreated: (drink: DrinkOption) => emit('drink:created', drink),
};
