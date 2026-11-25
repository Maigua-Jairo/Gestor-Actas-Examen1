import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { BottomSheet, Button, Notice, Pill } from "@/components/ui";
import type { MesaRecinto, VeedorRecinto } from "@/domain/recinto.use-cases";
import { dignidadesActa } from "@/domain/schemas/acta";
import { recintoUseCases } from "@/presentation/recinto";
import { estadoMesaRecinto, nombreCorto } from "@/presentation/recinto-ui";
import { dignityLabel, openActa } from "@/presentation/veedor-ui";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type MesaSheetProps = {
  mesa: MesaRecinto | null;
  veedores: VeedorRecinto[];
  asignacionesDisponibles: boolean;
  onClose: () => void;
  /** Se llama tras cambiar el veedor, para recargar el tablero. */
  onAssigned: (mensaje: string) => void;
  onCreateWatcher: () => void;
};

/**
 * Hoja inferior con el detalle de una mesa: estado de sus actas y asignación
 * o reemplazo del veedor (RF-08, RF-20). Es propia de la app, no un diálogo del sistema.
 */
export function MesaSheet({
  mesa,
  veedores,
  asignacionesDisponibles,
  onClose,
  onAssigned,
  onCreateWatcher,
}: MesaSheetProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!mesa) return null;

  const currentId = mesa.veedor?.id ?? null;
  const chosen = selected ?? currentId;
  const visual = estadoMesaRecinto[mesa.estado];

  async function save(): Promise<void> {
    if (!mesa || !chosen || chosen === currentId) return;
    setSaving(true);
    setError("");
    try {
      await recintoUseCases.asignarVeedor.execute(mesa.id, chosen);
      const veedor = veedores.find((item) => item.id === chosen);
      onAssigned(
        `Mesa ${mesa.numeroJrv} asignada a ${veedor ? nombreCorto(veedor) : "el veedor"}.${
          currentId ? " El veedor anterior ya no tiene acceso a esta mesa." : ""
        }`,
      );
      setSelected(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "No fue posible asignar el veedor.",
      );
    } finally {
      setSaving(false);
    }
  }

  function close(): void {
    setSelected(null);
    setError("");
    onClose();
  }

  return (
    <BottomSheet visible onClose={close} closeLabel="Cerrar detalle de la mesa">
          <View style={styles.headerRow}>
            <View style={styles.flex}>
              <Text style={styles.title} accessibilityRole="header">
                Mesa {mesa.numeroJrv}
              </Text>
              <Text style={styles.subtitle}>
                {mesa.genero ? `${mesa.genero} · ` : ""}
                {mesa.veedor ? `Veedor: ${nombreCorto(mesa.veedor)}` : "Sin veedor asignado"}
              </Text>
            </View>
            <Pill label={visual.label} tone={visual.tone} />
          </View>

          <Text style={styles.section}>ACTAS</Text>
          {dignidadesActa.map((dignidad) => {
            const acta = mesa.actas.find((item) => item.dignidad === dignidad);
            return (
              <View key={dignidad} style={styles.actaRow}>
                <View style={styles.flex}>
                  <Text style={styles.actaTitle}>{dignityLabel[dignidad]}</Text>
                  <Text
                    style={[
                      styles.actaText,
                      acta?.requiereRevision ? { color: colors.syncErrorText } : null,
                    ]}
                  >
                    {!acta
                      ? "Aún no registrada por el veedor"
                      : acta.requiereRevision && acta.distanciaM !== null
                        ? `Tomada a ${Math.round(acta.distanciaM)} m del recinto · versión ${acta.version}`
                        : `Recibida · versión ${acta.version}`}
                  </Text>
                </View>
                {acta ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      close();
                      openActa(mesa.id, dignidad);
                    }}
                    style={({ pressed }) => [styles.actaButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.actaButtonText}>
                      {acta.requiereRevision ? "Revisar" : "Ver"}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          <Text style={styles.section}>
            {mesa.veedor ? "REEMPLAZAR VEEDOR" : "ASIGNAR VEEDOR"}
          </Text>
          {!asignacionesDisponibles ? (
            <Notice tone="warning">
              Sin conexión no se pueden ver ni cambiar las asignaciones.
            </Notice>
          ) : veedores.length === 0 ? (
            <Notice tone="info">Aún no hay veedores en este recinto. Cree uno para asignarlo.</Notice>
          ) : (
            veedores.map((veedor, index) => {
              const isChosen = chosen === veedor.id;
              return (
                <Animated.View key={veedor.id} entering={FadeInDown.delay(index * 40).duration(260)}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isChosen }}
                    onPress={() => setSelected(veedor.id)}
                    style={[styles.option, isChosen && styles.optionChosen]}
                  >
                    <View style={[styles.radio, isChosen && styles.radioChosen]}>
                      {isChosen ? <View style={styles.radioDot} /> : null}
                    </View>
                    <Text style={styles.optionText}>
                      {veedor.nombres} {veedor.apellidos}
                    </Text>
                    {veedor.id === currentId ? <Pill label="Actual" tone="info" /> : null}
                  </Pressable>
                </Animated.View>
              );
            })
          )}

          {error ? <Notice tone="error">{error}</Notice> : null}

          <View style={styles.actions}>
            {asignacionesDisponibles && veedores.length > 0 ? (
              <Button
                label={mesa.veedor ? "Guardar reemplazo" : "Asignar veedor"}
                loading={saving}
                disabled={!chosen || chosen === currentId}
                onPress={() => void save()}
              />
            ) : null}
            <Button
              variant="secondary"
              label="Crear veedor nuevo"
              icon={<Ionicons name="person-add-outline" size={18} color={colors.primary} />}
              onPress={() => {
                close();
                onCreateWatcher();
              }}
            />
            <Button variant="ghost" label="Cerrar" onPress={close} />
          </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  title: { color: colors.navy, fontFamily: fonts.bold, fontSize: 24 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15, marginTop: 2 },
  section: {
    color: colors.textAuxiliary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 8,
  },
  actaRow: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 14,
  },
  actaTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  actaText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  actaButton: {
    alignItems: "center",
    borderColor: colors.primary,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 2,
    minHeight: 36,
    paddingLeft: 14,
    paddingRight: 8,
  },
  actaButtonText: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 14 },
  pressed: { opacity: 0.6 },
  option: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
  },
  optionChosen: { borderColor: colors.primary, borderWidth: 2 },
  radio: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  radioChosen: { borderColor: colors.primary },
  radioDot: { backgroundColor: colors.primary, borderRadius: 6, height: 12, width: 12 },
  optionText: { color: colors.text, flex: 1, fontFamily: fonts.semiBold, fontSize: 16 },
  actions: { gap: 8, marginTop: 8 },
});
