import type {NextFunction, Request, Response} from 'express';
import {ZodError} from 'zod';

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as {code?: string}).code === 'NOT_FOUND';
}

function isInvalidId(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith('Id de pedido inválido');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({error: 'Dados inválidos', details: error.flatten()});
  }
  if (isInvalidId(error)) {
    return res.status(400).json({error: error.message});
  }
  if (isNotFound(error)) {
    return res.status(404).json({error: 'Recurso não encontrado'});
  }
  console.error(error);
  res.status(500).json({error: 'Erro interno'});
}
