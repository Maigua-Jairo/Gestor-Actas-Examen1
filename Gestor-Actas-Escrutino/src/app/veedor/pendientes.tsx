import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "expo-router";
import { useNetInfo } from "@react-native-community/netinfo";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ZoomIn,
} from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Button, LottieAnimation, Notice, Pill, Skeleton } from "@/components/ui";
import type { ActaEnColaVeedora, ColaVeedora } from "@/domain/veedor.use-cases";
import { offlineUseCases } from "@/presentation/offline";
import { veedorUseCases } from "@/presentation/veedor";
import {
  describeErrorEnvio,
  dignityLabel,
  haceCuanto,
  openActa,
  requiereCorreccion,
} from "@/presentation/veedor-ui";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

/** Mientras haya envíos en curso, la lista se refresca cada pocos segundos. */
const POLL_MS = 4000;

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No fue posible consultar las actas pendientes.";
}

export default function PendientesScreen() {
  const { isConnected, isInternetReachable } = useNetInfo();
  const online = isConnected === true && isInternetReachable !== false;
  const offline = isConnected === false || isInternetReachable === false;

  const [cola, setCola] = useState<ColaVeedora | null>(null);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const wasOnline = useRef<boolean | null>(null);

  const load = useCallback(async () => {
    try {
      setCola(await veedorUseCases.listarActasEnCola.execute());
      setError("");
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      await veedorUseCases.sincronizarPendientes.execute().catch(() => undefined);
      await load();
    } finally {
      setSyncing(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Seguimiento en vivo de los envíos que están en curso.
  const hasInProgress = (cola?.enProceso ?? 0) > 0 || syncing;
  useFocusEffect(
    useCallback(() => {
      if (!hasInProgress) return undefined;
      const timer = setInterval(() => void load(), POLL_MS);
      return () => clearInterval(timer);
    }, [hasInProgress, load]),
  );

  // Al volver la señal se envía la cola sin que el veedor haga nada.
  useEffect(() => {
    const previous = wasOnline.current;
    wasOnline.current = online;
    if (online && previous === false) {
      void syncNow();
    }
  }, [online, syncNow]);

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    try {
      if (online) await syncNow();
      else await load();
    } finally {
      setRefreshing(false);
    }
  }

  const queued = cola?.actas ?? [];
  const allSent = cola !== null && queued.length === 0;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <ScreenHeader
          eyebrow="Sincronización"
          title="Pendientes"
          subtitle="Las actas se envían solas al recuperar la señal."
        />

        <View style={styles.body}>
          {error ? <Notice tone="error">{error}</Notice> : null}

          {!cola && !error ? (
            <View style={styles.loading}>
              <View style={styles.countersRow}>
                <Skeleton height={84} width="31%" radius={18} />
                <Skeleton height={84} width="31%" radius={18} />
                <Skeleton height={84} width="31%" radius={18} />
              </View>
              <Skeleton height={96} radius={18} />
              <Skeleton height={96} radius={18} />
            </View>
          ) : null}

          {cola ? (
            <Animated.View entering={FadeInDown.duration(360)} style={styles.countersRow}>
              <Counter value={cola.fallidas} label="Fallidas" color={colors.syncErrorText} />
              <Counter value={cola.enProceso} label="En proceso" color={colors.primary} />
              <Counter
                value={cola.pendientes}
                label="Pendientes"
                color={colors.syncPendingText}
              />
            </Animated.View>
          ) : null}

          {queued.map((acta, index) => (
            <QueueCard
              key={acta.id}
              acta={acta}
              index={index}
              syncing={syncing}
              offline={offline}
              onRetry={() => void syncNow()}
              onDiscarded={() => void load()}
            />
          ))}

          {cola?.enviadasRecientes.map((sent) => (
            <Animated.View
              key={sent.id}
              entering={FadeIn.duration(400)}
              layout={LinearTransition.duration(250)}
              style={styles.sentRow}
            >
              <View style={styles.sentIcon}>
                <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
              </View>
              <Text style={styles.sentText}>
                Mesa {sent.mesa} · {dignityLabel[sent.dignidad]} enviada{" "}
                {haceCuanto(sent.enviadaEn)}
              </Text>
            </Animated.View>
          ))}

          {allSent ? <AllSent /> : null}
        </View>
      </ScrollView>

      {queued.length > 0 ? (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.footer}>
          {offline ? (
            <View style={styles.offlineBanner} accessibilityRole="text">
              <Ionicons name="cloud-offline-outline" size={20} color={colors.syncPendingText} />
              <Text style={styles.offlineText}>Se enviarán solas al recuperar la señal</Text>
            </View>
          ) : (
            <Button
              label={syncing ? "Enviando…" : "Enviar ahora"}
              icon={<Ionicons name="cloud-upload-outline" size={20} color={colors.onPrimary} />}
              loading={syncing}
              onPress={() => void syncNow()}
            />
          )}
        </Animated.View>
      ) : null}
    </View>
  );
}

function Counter({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={styles.counter} accessibilityLabel={`${label}: ${value}`}>
      {/* La clave cambia con el valor: el número "rebota" cada vez que se actualiza. */}
      <Animated.Text
        key={value}
        entering={ZoomIn.springify().damping(12)}
        style={[styles.counterValue, { color }]}
      >
        {value}
      </Animated.Text>
      <Text style={styles.counterLabel}>{label}</Text>
    </View>
  );
}

const queueVisual: Record<
  ActaEnColaVeedora["estado"],
  { label: string; tone: "danger" | "info" | "warning"; border: string; icon: "close" | "sync" | "time-outline" }
> = {
  fallado: { label: "Falló", tone: "danger", border: colors.syncErrorText, icon: "close" },
  proceso: { label: "En proceso", tone: "info", border: colors.primary, icon: "sync" },
  pendiente: {
    label: "Pendiente",
    tone: "warning",
    border: colors.syncPendingText,
    icon: "time-outline",
  },
};

function QueueCard({
  acta,
  index,
  syncing,
  offline,
  onRetry,
  onDiscarded,
}: {
  acta: ActaEnColaVeedora;
  index: number;
  syncing: boolean;
  offline: boolean;
  onRetry: () => void;
  onDiscarded: () => void;
}) {
  const visual = queueVisual[acta.estado];
  const needsFix = acta.estado === "fallado" && requiereCorreccion(acta.ultimoError);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState("");

  async function discard(): Promise<void> {
    setDiscarding(true);
    setDiscardError("");
    try {
      await offlineUseCases.descartarActa.execute(acta.id);
      onDiscarded();
    } catch (error) {
      setDiscardError(error instanceof Error ? error.message : "No se pudo descartar el acta.");
      setDiscarding(false);
    }
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(80 + index * 50).duration(360)}
      exiting={FadeOut.duration(250)}
      layout={LinearTransition.duration(250)}
      style={[styles.card, { borderLeftColor: visual.border }]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTexts}>
          <Text style={styles.cardTitle}>
            Mesa {acta.mesa} · {dignityLabel[acta.dignidad]}
          </Text>
          {acta.estado === "fallado" ? (
            <Text style={styles.cardText}>
              {describeErrorEnvio(acta.ultimoError)}
              {acta.intentos > 1 ? ` · ${acta.intentos} intentos` : ""}
            </Text>
          ) : acta.estado === "proceso" ? (
            <View style={styles.inlineRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.cardText}>Enviando acta y foto…</Text>
            </View>
          ) : (
            <Text style={styles.cardText}>
              Guardada en el teléfono {haceCuanto(acta.guardadaEn)}
            </Text>
          )}
        </View>
        <Pill label={visual.label} tone={visual.tone} icon={visual.icon} />
      </View>

      {acta.estado === "fallado" ? (
        <View style={styles.cardActions}>
          {needsFix ? (
            <Button
              label="Corregir acta"
              icon={<Ionicons name="create-outline" size={20} color={colors.onPrimary} />}
              onPress={() => openActa(acta.mesaId, acta.dignidad)}
            />
          ) : (
            <>
              <Button
                variant="danger"
                label={offline ? "Sin señal para reintentar" : "Reintentar envío"}
                loading={syncing}
                disabled={offline}
                onPress={onRetry}
              />
              <Button
                variant="ghost"
                label="Revisar o corregir el acta"
                onPress={() => openActa(acta.mesaId, acta.dignidad)}
              />
            </>
          )}
        </View>
      ) : null}

      {acta.estado !== "proceso" ? (
        confirmingDiscard ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.cardActions}>
            <Notice tone="warning">
              El acta y su foto se borrarán de este teléfono y no llegarán al recinto. Esto no
              se puede deshacer.
            </Notice>
            {discardError ? <Notice tone="error">{discardError}</Notice> : null}
            <View style={styles.confirmRow}>
              <View style={styles.flex}>
                <Button
                  variant="secondary"
                  label="Cancelar"
                  onPress={() => setConfirmingDiscard(false)}
                  disabled={discarding}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  variant="danger"
                  label="Descartar"
                  loading={discarding}
                  onPress={() => void discard()}
                />
              </View>
            </View>
          </Animated.View>
        ) : (
          <Button
            variant="ghostDanger"
            label="Descartar del teléfono"
            icon={<Ionicons name="trash-outline" size={18} color={colors.syncErrorText} />}
            onPress={() => setConfirmingDiscard(true)}
          />
        )
      ) : null}
    </Animated.View>
  );
}

function AllSent() {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.allSent}>
      <LottieAnimation
        name="success"
        size={140}
        fallback={
          <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.allSentIcon}>
            <Ionicons name="checkmark-done" size={34} color={colors.onPrimary} />
          </Animated.View>
        }
      />
      <Text style={styles.allSentTitle}>Todo enviado</Text>
      <Text style={styles.allSentText}>
        No hay actas esperando en este teléfono. Las que registre sin señal
        aparecerán aquí hasta que se envíen.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  body: {
    alignSelf: "center",
    gap: 12,
    maxWidth: 620,
    paddingHorizontal: 20,
    paddingTop: 18,
    width: "100%",
  },
  loading: { gap: 12 },
  countersRow: { flexDirection: "row", gap: 10, justifyContent: "space-between" },
  counter: {
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    padding: 14,
  },
  counterValue: { fontFamily: fonts.bold, fontSize: 28 },
  counterLabel: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  card: {
    backgroundColor: colors.paper,
    borderBottomColor: colors.borderSoftBlue,
    borderBottomWidth: 1,
    borderLeftWidth: 5,
    borderRadius: 18,
    borderRightColor: colors.borderSoftBlue,
    borderRightWidth: 1,
    borderTopColor: colors.borderSoftBlue,
    borderTopWidth: 1,
    gap: 12,
    padding: 16,
  },
  cardHeader: { alignItems: "center", flexDirection: "row", gap: 10 },
  cardTexts: { flex: 1, gap: 4 },
  cardTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
  cardText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
  inlineRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  cardActions: { gap: 8 },
  confirmRow: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  sentRow: {
    alignItems: "center",
    backgroundColor: colors.syncOkBg,
    borderColor: colors.syncOkBorder,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 14,
  },
  sentIcon: {
    alignItems: "center",
    backgroundColor: colors.syncOkText,
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  sentText: { color: colors.syncOkText, flex: 1, fontFamily: fonts.semiBold, fontSize: 15 },
  allSent: { alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 20 },
  allSentIcon: {
    alignItems: "center",
    backgroundColor: colors.syncOkText,
    borderRadius: 36,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  allSentTitle: { color: colors.navy, fontFamily: fonts.bold, fontSize: 20 },
  allSentText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  footer: {
    backgroundColor: colors.paper,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  offlineBanner: {
    alignItems: "center",
    backgroundColor: colors.syncPendingBg,
    borderColor: colors.syncPendingBorder,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 14,
  },
  offlineText: { color: colors.syncPendingText, fontFamily: fonts.semiBold, fontSize: 16 },
});
