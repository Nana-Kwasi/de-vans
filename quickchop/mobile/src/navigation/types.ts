import { NavigatorScreenParams } from "@react-navigation/native";
import { MenuItem, Order } from "@/api/types";

/** Bottom tabs (the app's main sections). */
export type TabParamList = {
  Home: undefined;
  Orders: undefined;
  Wallet: undefined; // labelled "Payment" in the tab bar
  Profile: undefined;
};

/** Root stack: the tabs plus the pushed detail / checkout / profile screens. */
export type RootStackParamList = {
  Welcome: undefined;
  SignUp: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  // `item` when navigating inside the app (we already have it); `itemId` when arriving
  // from a shared link, where only the id travels and the screen resolves the rest.
  ItemDetail: { item: MenuItem; itemId?: undefined } | { item?: undefined; itemId: string };
  Cart: undefined;
  DeliveryDetails: undefined;
  Payment: { order: Order };
  OrderTracking: { orderId: string };
  EditProfile: undefined;
  DeliveryAddresses: undefined;
  Notifications: undefined;
  HelpSupport: undefined;
};
