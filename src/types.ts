export type OrderStatus = 'pending' | 'in_progress' | 'completed';
export type MilkType = 'normal' | 'zero' | 'vegetal';
export type DrinkType = string;

export interface DrinkItem {
  id: string;
  type: DrinkType;
  label: string;
  quantity: number;
  milk: MilkType;
  notes: string;
  price: number;
}

export interface Order {
  id: string;
  customerName: string;
  items: DrinkItem[];
  status: OrderStatus;
  total: number;
  createdAt: number;
}

export interface CreateOrderDTO {
  customerName: string;
  items: DrinkItem[];
}

export interface DrinkOption {
  type: DrinkType;
  label: string;
  price: number;
  hasMilk: boolean;
}

export interface MilkOption {
  type: MilkType;
  label: string;
  priceAdd: number;
}

export interface NewDrinkInput {
  label: string;
  price: number;
  hasMilk: boolean;
}

export const MILK_OPTIONS: MilkOption[] = [
  {type: 'normal', label: 'Normal', priceAdd: 0},
  {type: 'zero', label: 'Zero', priceAdd: 2.0},
  {type: 'vegetal', label: 'Vegetal', priceAdd: 4.0},
];
