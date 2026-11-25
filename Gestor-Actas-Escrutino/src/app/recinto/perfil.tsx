import { useEffect, useState } from "react";

import { ProfileView, type FilaPerfil } from "@/components/ProfileView";
import { usePerfil } from "@/presentation/usePerfil";
import { territoryUseCases } from "@/presentation/territory";
import { veedorUseCases } from "@/presentation/veedor";

export default function PerfilRecintoScreen() {
  const { profile, error, queueCount, lastSync, signingOut, signOut } = usePerfil("recinto");
  const [contextLine, setContextLine] = useState<string | null>(null);
  const [extraRows, setExtraRows] = useState<FilaPerfil[]>([]);

  useEffect(() => {
    const recintoId = profile?.recintoId;
    if (!recintoId) return;
    let active = true;
    void Promise.all([
      veedorUseCases.obtenerNombreRecinto.execute(recintoId),
      territoryUseCases.obtenerTableroAsignaciones.execute(recintoId).catch(() => null),
    ]).then(([nombre, tablero]) => {
      if (!active) return;
      setContextLine(nombre);
      if (tablero) {
        setExtraRows([
          { label: "Veedores a cargo", value: String(tablero.veedores.length) },
          { label: "Mesas del recinto", value: String(tablero.mesas.length) },
        ]);
      }
    });
    return () => {
      active = false;
    };
  }, [profile]);

  return (
    <ProfileView
      profile={profile}
      roleLabel="Coordinador de recinto"
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
