import {Router} from 'express';
import {drinkService} from '../services/drinkService';
import {newDrinkSchema} from '../schemas';
import {events} from '../socket';
import {asyncHandler} from '../asyncHandler';

export const drinksRouter = Router();

drinksRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const drinks = await drinkService.getDrinkOptions();
    res.json(drinks);
  }),
);

drinksRouter.get('/milk-options', (_req, res) => {
  res.json(drinkService.getMilkOptions());
});

drinksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = newDrinkSchema.parse(req.body);
    const drink = await drinkService.addDrink(input);
    events.drinkCreated(drink);
    res.status(201).json(drink);
  }),
);
