import React, { useEffect } from "react";
import { Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList, TabParamList } from "./types";
import { colors } from "@/theme/glass";
import { useAuth } from "@/store/auth";
import { useConfig } from "@/store/config";
import { WelcomeScreen } from "@/screens/WelcomeScreen";
import { SignUpScreen } from "@/screens/SignUpScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { ItemDetailScreen } from "@/screens/ItemDetailScreen";
import { CartScreen } from "@/screens/CartScreen";
import { DeliveryDetailsScreen } from "@/screens/DeliveryDetailsScreen";
import { PaymentScreen } from "@/screens/PaymentScreen";
import { OrderTrackingScreen } from "@/screens/OrderTrackingScreen";
import { OrderHistoryScreen } from "@/screens/OrderHistoryScreen";
import { WalletScreen } from "@/screens/WalletScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { EditProfileScreen } from "@/screens/EditProfileScreen";
import { DeliveryAddressesScreen } from "@/screens/DeliveryAddressesScreen";
import { NotificationsScreen } from "@/screens/NotificationsScreen";
import { HelpSupportScreen } from "@/screens/HelpSupportScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

type IconName = keyof typeof Ionicons.glyphMap;
const TAB_ICON: Record<keyof TabParamList, [IconName, IconName]> = {
  Home: ["home", "home-outline"],
  Orders: ["receipt", "receipt-outline"],
  Wallet: ["card", "card-outline"],
  Profile: ["person", "person-outline"],
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = TAB_ICON[route.name];
          return <Ionicons name={focused ? active : inactive} size={size ?? 22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Home" }} />
      <Tab.Screen name="Orders" component={OrderHistoryScreen} options={{ title: "Orders" }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ title: "Payment" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const init = useAuth((s) => s.init);
  const loadConfig = useConfig((s) => s.load);

  useEffect(() => {
    init();
    loadConfig();
  }, [init, loadConfig]);

  // The whole app is browsable as a guest. Login is only prompted at checkout
  // and on the account tabs (Orders / Payment / Profile) — see each screen.
  // The Welcome screen shows on every launch, then the user enters the app.
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="DeliveryDetails" component={DeliveryDetailsScreen} />
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="DeliveryAddresses" component={DeliveryAddressesScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} options={{ presentation: "modal" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
