import { Tabs } from "expo-router";

import { RoleBottomNav } from "@/components/RoleBottomNav";

export default function VeedorTabsLayout() {
  return (
    <Tabs
      // Una sola barra: la del diseño, en lugar de la predeterminada de Tabs.
      tabBar={() => <RoleBottomNav role="veedor" />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="pendientes" options={{ title: "Pendientes" }} />
      <Tabs.Screen name="actas" options={{ title: "Mis actas" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
