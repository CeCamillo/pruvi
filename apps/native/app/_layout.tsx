import "@/global.css";
import { Redirect, Slot, useSegments } from "expo-router";
import { getAuthRedirectTarget } from "@/lib/auth-redirect";
import { HeroUINativeProvider, Spinner } from "heroui-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Text, View } from "react-native";

import { AppThemeProvider } from "@/contexts/app-theme-context";
import { authClient } from "@/lib/auth-client";
import { usePreferences } from "@/hooks/useOnboarding";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

function LoadingScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center">
      <Spinner size="lg" />
    </View>
  );
}

function AuthGate() {
  const session = authClient.useSession();
  const segments = useSegments();
  const prefs = usePreferences({ enabled: !!session.data });

  const result = getAuthRedirectTarget(
    {
      isPending: session.isPending,
      error: session.error,
      data: session.data,
    },
    {
      isPending: prefs.isPending,
      data: prefs.data,
    },
    segments
  );

  if (result.kind === "loading") return <LoadingScreen />;
  if (result.kind === "error") {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-foreground text-base text-center">
          Não foi possível verificar sua sessão. Verifique sua conexão e tente novamente.
        </Text>
      </View>
    );
  }
  if (result.kind === "redirect") return <Redirect href={result.href} />;
  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <AppThemeProvider>
            <HeroUINativeProvider>
              <AuthGate />
            </HeroUINativeProvider>
          </AppThemeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
