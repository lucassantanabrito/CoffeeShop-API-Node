import {Router} from 'express';
import type {Request} from 'express';
import {reportService} from '../services/reportService';
import {
  historyFiltersSchema,
  historyQuerySchema,
  ordersByDayQuerySchema,
  summaryQuerySchema,
} from '../schemas';
import {dayKey} from '../businessTime';
import {asyncHandler} from '../asyncHandler';

export const reportsRouter = Router();

// Formulários web mandam filtros vazios como `status=`; trata como ausentes.
function cleanQuery(req: Request): Record<string, unknown> {
  return Object.fromEntries(Object.entries(req.query).filter(([, value]) => value !== ''));
}

reportsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const {period} = summaryQuerySchema.parse(cleanQuery(req));
    res.json(await reportService.getSummary(period));
  }),
);

reportsRouter.get(
  '/orders-by-day',
  asyncHandler(async (req, res) => {
    const {days} = ordersByDayQuerySchema.parse(cleanQuery(req));
    res.json(await reportService.getOrdersByDay(days));
  }),
);

reportsRouter.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const {page, pageSize, ...filters} = historyQuerySchema.parse(cleanQuery(req));
    res.json(await reportService.listOrders(filters, page, pageSize));
  }),
);

reportsRouter.get(
  '/orders.csv',
  asyncHandler(async (req, res) => {
    const filters = historyFiltersSchema.parse(cleanQuery(req));
    const csv = await reportService.exportOrdersCsv(filters);
    res
      .type('text/csv; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="pedidos-${dayKey(Date.now())}.csv"`)
      .send(csv);
  }),
);
