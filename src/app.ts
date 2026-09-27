import express from 'express';
import type {Express} from 'express';
import cors from 'cors';
import {createServer} from 'http';
import type {Server as HttpServer} from 'http';
import {ordersRouter} from './routes/orders';
import {drinksRouter} from './routes/drinks';
import {errorHandler} from './errorHandler';
import {initSocket} from './socket';

export interface App {
  app: Express;
  httpServer: HttpServer;
}

// Extraído de index.ts pra permitir montar o app (com o Socket.io já
// inicializado em cima do mesmo httpServer) sem precisar abrir a porta
// de verdade — é isso que os testes de integração/socket usam.
export function createApp(): App {
  const app = express();
  const httpServer = createServer(app);

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({status: 'ok'});
  });

  app.use('/orders', ordersRouter);
  app.use('/drinks', drinksRouter);

  app.use(errorHandler);

  initSocket(httpServer);

  return {app, httpServer};
}
