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

export type ReportPeriod = 'today' | '7d' | '30d';

export interface MetricComparison {
  value: number;
  previous: number;
  // Variação percentual vs. o período anterior; null se o anterior for 0.
  deltaPct: number | null;
}

export interface TopDrink {
  type: DrinkType;
  label: string;
  quantity: number;
}

export interface SummaryReport {
  period: ReportPeriod;
  from: number;
  to: number;
  orders: MetricComparison;
  revenue: MetricComparison;
  averageTicket: MetricComparison;
  topDrink: TopDrink | null;
}

export interface DailyOrders {
  date: string;
  orders: number;
  revenue: number;
}

export interface OrdersFilters {
  from?: string;
  to?: string;
  status?: OrderStatus;
  drink?: string;
  search?: string;
}

export interface OrdersPage {
  data: Order[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
