// ─── Core Domain Types ────────────────────────────────────────────────────────

export type OrderStatus =
  | 'Delivered'
  | 'Cancelled'
  | 'Pending'
  | 'Preparing'
  | 'Out for Delivery';

export type PaymentMethod =
  | 'UPI'
  | 'Credit Card'
  | 'Debit Card'
  | 'Cash on Delivery'
  | 'Wallet';

export type FoodCategory =
  | 'Biryani'
  | 'North Indian'
  | 'South Indian'
  | 'Chinese'
  | 'Fast Food'
  | 'Pizza'
  | 'Desserts'
  | 'Beverages'
  | 'Street Food';

export type CustomerType = 'New' | 'Regular' | 'Premium' | 'Churned';

export type RestaurantStatus = 'Active' | 'Inactive' | 'Suspended';

// ─── Order ────────────────────────────────────────────────────────────────────

export interface Order {
  order_id: string;
  customer_id: string;
  restaurant_id: string;
  restaurant_name: string;
  food_category: FoodCategory;
  cuisine: string;
  order_date: string;        // ISO date string YYYY-MM-DD
  order_time: string;        // HH:MM (24-hour)
  order_amount: number;      // base price before fees/discounts
  delivery_fee: number;
  discount: number;
  final_amount: number;      // order_amount + delivery_fee - discount
  delivery_time_minutes: number;
  order_status: OrderStatus;
  payment_method: PaymentMethod;
  city: string;
  area: string;
  rating: number | null;     // 1–5, null if not yet delivered or cancelled
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface Customer {
  customer_id: string;
  customer_name: string;
  city: string;
  area: string;
  total_orders: number;
  total_spending: number;
  average_order_value: number;
  customer_type: CustomerType;
}

// ─── Restaurant ───────────────────────────────────────────────────────────────

export interface Restaurant {
  restaurant_id: string;
  restaurant_name: string;
  cuisine: string;
  city: string;
  area: string;
  rating: number;            // 1–5
  total_orders: number;
  total_revenue: number;
  average_delivery_time: number;
  cancellation_rate: number; // 0–1 fraction
  status: RestaurantStatus;
}
