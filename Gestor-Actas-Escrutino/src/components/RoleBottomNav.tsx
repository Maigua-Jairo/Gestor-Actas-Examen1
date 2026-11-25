import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useGlobalSearchParams, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export type RoleBottomNavType = "provincial" | "recinto" | "veedor";

type NavItem = {
  label: string;
  route:
    | "/provincial"
    | "/provincial/recintos"
    | "/provincial/coordinadores"
    | "/provincial/reportes"
    | "/provincial/perfil"
    | "/recinto/actas"
    | "/recinto"
    | "/recinto/mesas"
    | "/recinto/veedores"
    | "/recinto/perfil"
    | "/veedor"
    | "/veedor/pendientes"
    | "/veedor/actas"
    | "/veedor/perfil";
  icon: ComponentProps<typeof Ionicons>["name"];
  view?: "inicio" | "mesas";
};

const navByRole: Record<RoleBottomNavType, NavItem[]> = {
  provincial: [
    { label: "Inicio", route: "/provincial", icon: "home-outline" },
    { label: "Recintos", route: "/provincial/recintos", icon: "business-outline" },
    { label: "Coordinadores", route: "/provincial/coordinadores", icon: "people-outline" },
    { label: "Reportes", route: "/provincial/reportes", icon: "stats-chart-outline" },
    { label: "Perfil", route: "/provincial/perfil", icon: "person-outline" },
  ],
  recinto: [
    { label: "Inicio", route: "/recinto", icon: "home-outline" },
    { label: "Mesas", route: "/recinto/mesas", icon: "grid-outline" },
    { label: "Veedores", route: "/recinto/veedores", icon: "people-outline" },
    { label: "Actas", route: "/recinto/actas", icon: "document-text-outline" },
    { label: "Perfil", route: "/recinto/perfil", icon: "person-outline" },
  ],
  veedor: [
    { label: "Inicio", route: "/veedor", icon: "home-outline", view: "inicio" },
    { label: "Mesas", route: "/veedor", icon: "grid-outline", view: "mesas" },
    { label: "Pendientes", route: "/veedor/pendientes", icon: "time-outline" },
    { label: "Actas", route: "/veedor/actas", icon: "document-text-outline" },
    { label: "Perfil", route: "/veedor/perfil", icon: "person-outline" },
  ],
};

export function RoleBottomNav({ role }: { role: RoleBottomNavType }) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // Global: la barra se dibuja fuera de las pantallas y debe ver sus parámetros.
  const { vista } = useGlobalSearchParams<{ vista?: string }>();
  const items = navByRole[role];
  const activeIndex = items.findIndex(
    (item) => {
      if (pathname !== item.route) {
        return false;
      }

      const duplicateRoute = items.some(
        (candidate) =>
          candidate !== item && candidate.route === item.route,
      );
      return !duplicateRoute || item.view === (vista ?? "inicio");
    },
  );

  function navigate(item: NavItem) {
    // Inicio y Mesas del veedor son la misma pantalla con distinta vista.
    if (item.view && item.route === "/veedor") {
      router.replace({ pathname: "/veedor", params: { vista: item.view } });
      return;
    }

    router.replace(item.route);
  }

  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {items.map((item, index) => {
        const active = index === activeIndex;
        return (
          <Pressable
            key={`${item.label}-${item.route}`}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            onPress={() => navigate(item)}
            style={({ pressed }) => [
              styles.item,
              active && styles.itemActive,
              pressed && styles.itemPressed,
            ]}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={active ? colors.text : colors.textMuted}
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[styles.label, active && styles.active]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    minHeight: 72,
    width: "100%",
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.paper,
    paddingHorizontal: 6,
    paddingTop: 8,
  },
  item: {
    flex: 1,
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 6,
    borderTopWidth: 3,
    borderTopColor: "transparent",
  },
  itemActive: { borderTopColor: colors.text },
  itemPressed: { opacity: 0.7 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "600", textAlign: "center", fontFamily: fonts.semiBold },
  active: { color: colors.text, fontWeight: "700", fontFamily: fonts.bold },
});
