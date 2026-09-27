import 'dotenv/config';
import {createApp} from './app';

const {httpServer} = createApp();
const PORT = Number(process.env.PORT) || 3000;

httpServer.listen(PORT, () => {
  console.log(`CoffeeShop backend rodando em http://localhost:${PORT}`);
});
