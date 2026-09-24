import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {createServer} from 'http';
import {ordersRouter} from './routes/orders';
import {drinksRouter} from './routes/drinks';
import {errorHandler} from './errorHandler';
import {initSocket} from './socket';

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

const PORT = Number(process.env.PORT) || 3000;

httpServer.listen(PORT, () => {
  console.log(`CoffeeShop backend rodando em http://localhost:${PORT}`);
});
