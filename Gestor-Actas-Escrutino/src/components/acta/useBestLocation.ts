import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

import type { UbicacionActa } from "@/domain/schemas/acta";

export type EstadoBusquedaGps = "inactivo" | "buscando" | "listo" | "error";

export interface UbicacionCapturada {
  estado: EstadoBusquedaGps;
  ubicacion: UbicacionActa | null;
  /** Radio de error reportado por el GPS, en metros. */
  precisionM: number | null;
  error: string;
}

/** Precisión con la que se deja de buscar antes de agotar el tiempo. */
const PRECISION_SUFICIENTE_M = 15;
const TIEMPO_MAXIMO_MS = 12_000;

/**
 * Toma varias lecturas del GPS durante unos segundos y conserva la más
 * precisa (ADR-04). Funciona sin internet: el GPS no necesita datos móviles.
 */
export function useBestLocation(initial: UbicacionCapturada) {
  const [state, setState] = useState<UbicacionCapturada>(initial);
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    subscription.current?.remove();
    subscription.current = null;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    stop();
    setState({ estado: "buscando", ubicacion: null, precisionM: null, error: "" });

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setState({
          estado: "error",
          ubicacion: null,
          precisionM: null,
          error:
            "La ubicación es obligatoria. Active el permiso de ubicación para esta aplicación.",
        });
        return;
      }

      let best: Location.LocationObject | null = null;
      const finish = () => {
        stop();
        setState(
          best
            ? {
                estado: "listo",
                ubicacion: {
                  latitud: best.coords.latitude,
                  longitud: best.coords.longitude,
                },
                precisionM: best.coords.accuracy ?? null,
                error: "",
              }
            : {
                estado: "error",
                ubicacion: null,
                precisionM: null,
                error:
                  "No se pudo obtener la ubicación. Acérquese a una ventana o salga a un lugar abierto y reintente.",
              },
        );
      };

      subscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (reading) => {
          const accuracy = reading.coords.accuracy ?? Number.POSITIVE_INFINITY;
          const bestAccuracy = best?.coords.accuracy ?? Number.POSITIVE_INFINITY;
          if (!best || accuracy < bestAccuracy) {
            best = reading;
            setState((current) => ({
              ...current,
              ubicacion: {
                latitud: reading.coords.latitude,
                longitud: reading.coords.longitude,
              },
              precisionM: reading.coords.accuracy ?? null,
            }));
          }
          if (accuracy <= PRECISION_SUFICIENTE_M) {
            finish();
          }
        },
      );
      timer.current = setTimeout(finish, TIEMPO_MAXIMO_MS);
    } catch (locationError) {
      stop();
      setState({
        estado: "error",
        ubicacion: null,
        precisionM: null,
        error:
          locationError instanceof Error
            ? `No se pudo obtener la ubicación: ${locationError.message}`
            : "No se pudo obtener la ubicación.",
      });
    }
  }, [stop]);

  return { ...state, start };
}
