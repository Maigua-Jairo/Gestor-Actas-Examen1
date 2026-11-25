import { useEffect, useState } from "react";

import { ProfileView, type FilaPerfil } from "@/components/ProfileView";
import { usePerfil } from "@/presentation/usePerfil";
import { territoryUseCases } from "@/presentation/territory";

export default function PerfilProvincialScreen() {
  const { profile, error, queueCount, lastSync, signingOut, signOut } =
    usePerfil("provincial");
  const [extraRows, setExtraRows] = useState<FilaPerfil[]>([]);

  useEffect(() => {
    const provincia = profile?.provincia;
    if (!provincia) return;
    let active = true;
    territoryUseCases.listarRecintos
      .execute(provincia)
      .then((recintos) => {
        if (active) {
          setExtraRows([{ label: "Recintos a cargo", value: String(recintos.length) }]);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [profile]);

  return (
    <ProfileView
      profile={profile}
      roleLabel="Coordinador provincial"
      contextLine={profile?.provincia ?? null}
      extraRows={extraRows}
      queueCount={queueCount}
      lastSync={lastSync}
      error={error}
      signingOut={signingOut}
      onSignOut={() => void signOut()}
    />
  );
}
