import { Tabs } from "expo-router";

import { RoleBottomNav } from "@/components/RoleBottomNav";

export default function ProvincialTabsLayout() {
  return (
    <Tabs
      tabBar={() => <RoleBottomNav role="provincial" />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="recintos" options={{ title: "Recintos" }} />
      <Tabs.Screen name="coordinadores" options={{ title: "Coordinadores" }} />
      <Tabs.Screen name="reportes" options={{ title: "Reportes" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
