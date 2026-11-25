import { useEffect, useState } from "react";

import { ProfileView, type FilaPerfil } from "@/components/ProfileView";
import { listaConY } from "@/presentation/format";
import { usePerfil } from "@/presentation/usePerfil";
import { veedorUseCases } from "@/presentation/veedor";

export default function PerfilVeedorScreen() {
  const { profile, error, queueCount, lastSync, signingOut, signOut } = usePerfil("veedor");
  const [contextLine, setContextLine] = useState<string | null>(null);
  const [extraRows, setExtraRows] = useState<FilaPerfil[]>([]);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    // Funciona sin señal: el resumen usa la copia de mesas guardada en el teléfono.
    veedorUseCases.obtenerResumen
      .execute(profile.recintoId)
      .then((summary) => {
        if (!active) return;
        const numeros = summary.mesas.map((mesa) => String(mesa.numeroJrv));
        const mesas =
          numeros.length === 0
            ? null
            : `${numeros.length === 1 ? "Mesa" : "Mesas"} ${listaConY(numeros)}`;
        setContextLine([summary.recintoNombre, mesas].filter(Boolean).join(" · ") || null);
        setExtraRows([{ label: "Mesas a cargo", value: String(numeros.length) }]);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [profile]);

  return (
    <ProfileView
      profile={profile}
      roleLabel="Veedor"
      contextLine={contextLine}
      extraRows={extraRows}
      queueCount={queueCount}
      lastSync={lastSync}
      error={error}
      signingOut={signingOut}
      onSignOut={() => void signOut()}
    />
  );
}
