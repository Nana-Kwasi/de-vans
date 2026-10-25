import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RootNavigator } from "@/navigation/RootNavigator";
import { useAuthDeepLink } from "@/lib/useAuthDeepLink";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  // Email-confirmation and OAuth links land back in the app as deep links; this turns
  // them into a session. Without it, tapping the confirmation link does nothing.
  useAuthDeepLink();

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <RootNavigator />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
