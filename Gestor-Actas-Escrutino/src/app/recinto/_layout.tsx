import { Tabs } from "expo-router";

import { RoleBottomNav } from "@/components/RoleBottomNav";

export default function RecintoTabsLayout() {
  return (
    <Tabs
      tabBar={() => <RoleBottomNav role="recinto" />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="mesas" options={{ title: "Mesas" }} />
      <Tabs.Screen name="veedores" options={{ title: "Veedores" }} />
      <Tabs.Screen name="actas" options={{ title: "Actas recibidas" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
