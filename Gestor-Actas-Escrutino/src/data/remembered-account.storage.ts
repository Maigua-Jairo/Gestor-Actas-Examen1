import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const storageKey = "gestor-actas.escrutinio.remembered-account-email";

function getWebStorage(): Storage {
  if (typeof globalThis.localStorage === "undefined") {
    throw new Error("El almacenamiento local no está disponible.");
  }

  return globalThis.localStorage;
}

export async function getRememberedAccountEmail(): Promise<string | null> {
  if (Platform.OS === "web") {
    return getWebStorage().getItem(storageKey);
  }

  return SecureStore.getItemAsync(storageKey);
}

export async function saveRememberedAccountEmail(email: string): Promise<void> {
  if (Platform.OS === "web") {
    getWebStorage().setItem(storageKey, email);
    return;
  }

  await SecureStore.setItemAsync(storageKey, email);
}

export async function clearRememberedAccountEmail(): Promise<void> {
  if (Platform.OS === "web") {
    getWebStorage().removeItem(storageKey);
    return;
  }

  await SecureStore.deleteItemAsync(storageKey);
}
