export type OrderStatus =
  | "ORDER_RECEIVED"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "READY"
  | "CANCELLED";

export type MenuCategory = "rice" | "chicken" | "salad" | "drinks";

export interface AppConfig {
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

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  photoUrl?: string | null;
  category?: MenuCategory;
  available: boolean;
  featured?: boolean;
  createdAt?: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  addOns?: string | null;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  changedAt: string;
}

export interface Order {
  id: string;
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
  history: OrderStatusEvent[];
}

export interface Customer {
  id: string;
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
  defaultAddress?: string | null;
  createdAt: string;
}

export interface PaymentInitResponse {
  authorizationUrl: string;
  reference: string;
  accessCode: string;
}
