import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { PerfilUsuario } from "@/data/auth.repository";

const storageKey = "gestor-actas.escrutinio.sesion-local";

export interface SesionLocal {
  userId: string;
  email: string | null;
  perfil: PerfilUsuario;
  guardadaEn: string;
}

/*
 * Copia del perfil de la última sesión válida, para poder abrir la app sin
 * señal. Va en SecureStore (cifrado) porque contiene cédula y teléfono.
 * Se borra al cerrar sesión.
 */

async function read(): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(storageKey) ?? null;
  }
  return SecureStore.getItemAsync(storageKey);
}

export async function getSesionLocal(): Promise<SesionLocal | null> {
  try {
    const raw = await read();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SesionLocal;
    return parsed?.userId && parsed.perfil?.id === parsed.userId ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveSesionLocal(
  email: string | null,
  perfil: PerfilUsuario,
): Promise<void> {
  const value: SesionLocal = {
    userId: perfil.id,
    email,
    perfil,
    guardadaEn: new Date().toISOString(),
  };
  const raw = JSON.stringify(value);
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(storageKey, raw);
    return;
  }
  await SecureStore.setItemAsync(storageKey, raw);
}

export async function clearSesionLocal(): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(storageKey);
    return;
  }
  await SecureStore.deleteItemAsync(storageKey);
}
