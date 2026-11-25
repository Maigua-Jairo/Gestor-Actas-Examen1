import "react-native-url-polyfill/auto";

import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

declare const process: {
  env: Record<string, string | undefined>;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

const storageKeyPrefix = "gestor-actas.escrutino";

const secureStorage: SupportedStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === "web") {
      return globalThis.localStorage?.getItem(`${storageKeyPrefix}.${key}`) ??
        null;
    }

    return SecureStore.getItemAsync(`${storageKeyPrefix}.${key}`);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(`${storageKeyPrefix}.${key}`, value);
      return;
    }

    await SecureStore.setItemAsync(`${storageKeyPrefix}.${key}`, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      globalThis.localStorage?.removeItem(`${storageKeyPrefix}.${key}`);
      return;
    }

    await SecureStore.deleteItemAsync(`${storageKeyPrefix}.${key}`);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    flowType: "pkce",
    detectSessionInUrl: false,
  },
});