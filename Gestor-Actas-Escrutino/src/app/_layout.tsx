import { Stack } from "expo-router";
import { useEffect } from "react";
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import Ionicons from "@expo/vector-icons/Ionicons";
import NetInfo from "@react-native-community/netinfo";
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

import { offlineUseCases } from "@/presentation/offline";

declare const process: {
  env: Record<string, string | undefined>;
};

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: sentryDsn,
  sendDefaultPii: false,
  enableLogs: false,
  tracesSampleRate: 0,
  profilesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  maxBreadcrumbs: 50,
  environment: process.env.EXPO_PUBLIC_ENVIRONMENT ?? "development",
  release: `gestor-actas-escrutinio@${Constants.expoConfig?.version ?? "1.0.0"}`,
  beforeSend(event) {
    delete event.user;
    delete event.request;

    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
        ...breadcrumb,
        data: undefined,
        message: breadcrumb.message?.replace(
          /\b\d{10}\b/g,
          "[cedula]",
        ),
      }));
    }

    const sensitivePatterns =
      /\b(?:[Cc][Ee][Dd][Uu][Ll][Aa]|correo|tel[eé]fono|clave)\s*[:=]\s*[^\s,]+/gi;

    if (event.exception?.values) {
      for (const value of event.exception.values) {
        if (value.value) {
          value.value = value.value
            .replace(sensitivePatterns, "[dato-personal]")
            .replace(/\b\d{10}\b/g, "[cedula]");
        }
      }
    }

    return event;
  },
});

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Ionicons.font,
  });

  useEffect(() => {
    void offlineUseCases.initialize.execute();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        void offlineUseCases.sincronizarPendientes.execute();
      }
    });

    void NetInfo.fetch().then((state) => {
      if (state.isConnected && state.isInternetReachable) {
        void offlineUseCases.sincronizarPendientes.execute();
      }
    });

    return unsubscribe;
  }, []);

  if (fontError) {
    throw fontError;
  }
  if (!fontsLoaded) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default Sentry.wrap(RootLayout);