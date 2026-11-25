import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export type NoticeTone = "info" | "success" | "warning" | "error";

export type NoticeProps = {
  tone?: NoticeTone;
  children: ReactNode;
};

type IconName = ComponentProps<typeof Ionicons>["name"];

const toneStyles: Record<
  NoticeTone,
  { background: string; border: string; text: string; icon: IconName }
> = {
  info: {
    background: colors.surfaceMuted,
    border: colors.borderSoftBlue,
    text: colors.infoText,
    icon: "information-circle",
  },
  success: {
    background: colors.syncOkBg,
    border: colors.syncOkBorder,
    text: colors.syncOkText,
    icon: "checkmark-circle",
  },
  warning: {
    background: colors.syncPendingBg,
    border: colors.syncPendingBorder,
    text: colors.syncPendingText,
    icon: "alert-circle",
  },
  error: {
    background: colors.syncErrorBg,
    border: colors.syncErrorBorder,
    text: colors.syncErrorText,
    icon: "close-circle",
  },
};

export function Notice({ tone = "info", children }: NoticeProps) {
  const palette = toneStyles[tone];

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOut.duration(150)}
      accessibilityRole={tone === "error" ? "alert" : "text"}
      accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
      style={[
        styles.container,
        { backgroundColor: palette.background, borderColor: palette.border },
      ]}
    >
      <Ionicons name={palette.icon} size={20} color={palette.text} />
      <Text style={[styles.text, { color: palette.text }]}>{children}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  text: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
  },
});
