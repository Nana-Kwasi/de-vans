export type OrderStatus =
  | "ORDER_RECEIVED"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "READY"
  | "CANCELLED";

export interface AppSettings {
  businessName: string;
  acceptingOrders: boolean;
  closedMessage: string;
  contactPhone: string;
  storeAddress: string;
  announcementEnabled: boolean;
  announcementText: string;
  deliveryBaseFee: number;
  deliveryPerKm: number;
  deliveryMaxFee: number;
  freeDeliveryThreshold: number;
  minOrderAmount: number;
  maxDeliveryKm: number;
  storeLat: number;
  storeLng: number;
}

export type MenuCategory = "rice" | "chicken" | "salad" | "drinks";

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  photoUrl?: string | null;
  category: MenuCategory;
  available: boolean;
  featured?: boolean;
}

export interface Review {
  id: string;
  orderId?: string | null;
  customerId?: string | null;
  orderNumber?: string | null;
  name?: string | null;
  rating: number;
  comment?: string | null;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  addOns?: string | null;
}

export interface Order {
  id: string;
  customerId?: string | null;
  orderNumber: string;
  status: OrderStatus;
  pickup: boolean;
  deliveryAddress: string;
  deliveryTimeNote?: string | null;
  kitchenNote?: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

export interface Customer {
  id: string;
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
  defaultAddress?: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  ordersToday: number;
  revenueToday: number;
  ordersThisWeek: number;
  revenueThisWeek: number;
  ordersInRange: number;
  revenueInRange: number;
}

export type SupportStatus = "OPEN" | "RESOLVED";

export interface SupportTicket {
  id: string;
  customerId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  category: string;
  orderNumber?: string | null;
  message: string;
  status: SupportStatus;
  createdAt: string;
}
