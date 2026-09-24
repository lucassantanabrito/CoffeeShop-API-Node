import {Router} from 'express';
import {orderService} from '../services/orderService';
import {createOrderSchema, updateStatusSchema} from '../schemas';
import {events} from '../socket';
import {asyncHandler} from '../asyncHandler';

export const ordersRouter = Router();

ordersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const orders = await orderService.getOrders();
    res.json(orders);
  }),
);

ordersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) {
      res.status(404).json({error: 'Pedido não encontrado'});
      return;
    }
    res.json(order);
  }),
);

ordersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const dto = createOrderSchema.parse(req.body);
    const order = await orderService.createOrder(dto);
    events.orderCreated(order);
    res.status(201).json(order);
  }),
);

ordersRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const dto = createOrderSchema.parse(req.body);
    const order = await orderService.updateOrder(req.params.id, dto);
    events.orderUpdated(order);
    res.json(order);
  }),
);

ordersRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const {status} = updateStatusSchema.parse(req.body);
    const order = await orderService.updateOrderStatus(req.params.id, status);
    events.orderUpdated(order);
    res.json(order);
  }),
);

ordersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await orderService.deleteOrder(req.params.id);
    events.orderDeleted(req.params.id);
    res.status(204).send();
  }),
);
