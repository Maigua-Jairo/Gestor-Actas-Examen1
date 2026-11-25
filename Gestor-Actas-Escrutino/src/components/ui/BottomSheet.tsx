import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";

import { colors } from "@/theme/colors";

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Texto para lectores de pantalla del fondo que cierra la hoja. */
  closeLabel: string;
  children: ReactNode;
};

/**
 * Hoja que sube desde abajo sobre un fondo oscuro. Reemplaza a los diálogos
 * genéricos del sistema (RNF-06). Se cierra tocando el fondo o con "atrás".
 */
export function BottomSheet({ visible, onClose, closeLabel, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop}>
        <Pressable
          style={styles.fill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.springify().damping(18)}
        style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
      >
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: {
    backgroundColor: "rgba(15,27,45,0.45)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    bottom: 0,
    left: 0,
    maxHeight: "88%",
    position: "absolute",
    right: 0,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.borderStrong,
    borderRadius: 3,
    height: 5,
    marginTop: 10,
    width: 44,
  },
  content: { gap: 10, padding: 20 },
});
