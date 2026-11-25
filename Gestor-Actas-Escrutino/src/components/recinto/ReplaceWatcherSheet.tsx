import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { BottomSheet, Button, Notice } from "@/components/ui";
import type { MesaRecinto, VeedorRecinto } from "@/domain/recinto.use-cases";
import { listaConY } from "@/presentation/format";
import { recintoUseCases } from "@/presentation/recinto";
import { nombreCorto } from "@/presentation/recinto-ui";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export interface VeedorConMesas {
  veedor: VeedorRecinto;
  mesas: MesaRecinto[];
}

type ReplaceWatcherSheetProps = {
  /** Veedor a reemplazar (ausente); null cierra la hoja. */
  target: VeedorConMesas | null;
  others: VeedorConMesas[];
  onClose: () => void;
  onDone: (mensaje: string, error?: string) => void;
  /** Crear un veedor nuevo que reciba directamente estas mesas. */
  onCreateSubstitute: (mesas: MesaRecinto[]) => void;
};

/** Reemplazo de un veedor ausente: todas sus mesas pasan a otro veedor (RF-20, S-05). */
export function ReplaceWatcherSheet({
  target,
  others,
  onClose,
  onDone,
  onCreateSubstitute,
}: ReplaceWatcherSheetProps) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!target) return null;
  const numeros = target.mesas.map((mesa) => String(mesa.numeroJrv));
  const ausente = nombreCorto(target.veedor);

  function close(): void {
    setChosen(null);
    setError("");
    onClose();
  }

  async function transfer(): Promise<void> {
    if (!target || !chosen) return;
    setSaving(true);
    setError("");
    try {
      const result = await recintoUseCases.trasladarMesas.execute(
        target.mesas.map((mesa) => mesa.id),
        chosen,
      );
      const receptor = others.find((item) => item.veedor.id === chosen);
      const nombre = receptor ? nombreCorto(receptor.veedor) : "el nuevo veedor";
      const fallidas = target.mesas
        .filter((mesa) => result.fallidas.some((item) => item.mesaId === mesa.id))
        .map((mesa) => String(mesa.numeroJrv));
      setChosen(null);
      onDone(
        result.asignadas.length > 0
          ? `${result.asignadas.length === 1 ? "La mesa pasó" : "Las mesas pasaron"} a ${nombre}. ${ausente} ya no tiene acceso a ${result.asignadas.length === 1 ? "ella" : "ellas"}.`
          : "",
        fallidas.length > 0
          ? `No se pudo pasar ${fallidas.length === 1 ? "la mesa" : "las mesas"} ${listaConY(fallidas)}: ${result.fallidas[0].error}`
          : undefined,
      );
    } catch (transferError) {
      setError(
        transferError instanceof Error ? transferError.message : "No fue posible reemplazar al veedor.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible onClose={close} closeLabel="Cerrar reemplazo de veedor">
      <Text style={styles.title} accessibilityRole="header">
        Reemplazar a {ausente}
      </Text>
      {target.mesas.length === 0 ? (
        <Notice tone="info">
          {ausente} no tiene mesas asignadas, así que no hay nada que trasladar.
        </Notice>
      ) : (
        <Text style={styles.text}>
          {numeros.length === 1 ? "Su mesa" : "Sus mesas"}{" "}
          <Text style={styles.strong}>{listaConY(numeros)}</Text> pasarán al veedor que
          elija. {ausente} perderá el acceso de inmediato; las actas que ya registró se
          conservan con su historial.
        </Text>
      )}

      {target.mesas.length > 0 ? (
        <>
          <Text style={styles.section}>¿QUIÉN RECIBE LAS MESAS?</Text>
          {others.length === 0 ? (
            <Notice tone="info">No hay otros veedores. Cree un veedor sustituto.</Notice>
          ) : (
            others.map((item, index) => {
              const isChosen = chosen === item.veedor.id;
              return (
                <Animated.View key={item.veedor.id} entering={FadeInDown.delay(index * 40).duration(260)}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isChosen }}
                    onPress={() => setChosen(item.veedor.id)}
                    style={[styles.option, isChosen && styles.optionChosen]}
                  >
                    <View style={[styles.radio, isChosen && styles.radioChosen]}>
                      {isChosen ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.optionName}>
                        {item.veedor.nombres} {item.veedor.apellidos}
                      </Text>
                      <Text style={styles.optionMeta}>
                        {item.mesas.length === 0
                          ? "Sin mesas"
                          : `Ya cubre ${item.mesas.length === 1 ? "la mesa" : "las mesas"} ${listaConY(
                              item.mesas.map((mesa) => String(mesa.numeroJrv)),
                            )}`}
                      </Text>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })
          )}
        </>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      <View style={styles.actions}>
        {target.mesas.length > 0 && others.length > 0 ? (
          <Button
            label={
              chosen
                ? `Pasar ${numeros.length === 1 ? "mesa" : "mesas"} a ${nombreCorto(
                    others.find((item) => item.veedor.id === chosen)?.veedor ?? target.veedor,
                  )}`
                : "Elija quién recibe las mesas"
            }
            loading={saving}
            disabled={!chosen}
            onPress={() => void transfer()}
          />
        ) : null}
        {target.mesas.length > 0 ? (
          <Button
            variant="secondary"
            label="Crear veedor sustituto"
            icon={<Ionicons name="person-add-outline" size={18} color={colors.primary} />}
            onPress={() => {
              const mesas = target.mesas;
              close();
              onCreateSubstitute(mesas);
            }}
            disabled={saving}
          />
        ) : null}
        <Button variant="ghost" label="Cancelar" onPress={close} disabled={saving} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { color: colors.navy, fontFamily: fonts.bold, fontSize: 22 },
  text: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  strong: { color: colors.text, fontFamily: fonts.bold },
  section: {
    color: colors.textAuxiliary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 6,
  },
  option: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  optionName: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 16 },
  optionMeta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  actions: { gap: 8, marginTop: 8 },
});
