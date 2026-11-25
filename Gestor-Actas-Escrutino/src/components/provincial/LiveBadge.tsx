import { useEffect, useState } from "react";

import { Pill } from "@/components/ui";
import { haceCuanto } from "@/presentation/format";

/** "Actualizado hace 1 min": se refresca solo cada 30 segundos. */
export function LiveBadge({ actualizadoEn }: { actualizadoEn: string | null }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!actualizadoEn) return null;
  return <Pill tone="neutral" icon="time-outline" label={`Actualizado ${haceCuanto(actualizadoEn)}`} />;
}
