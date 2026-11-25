import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ScreenHeader } from "@/components/ScreenHeader";
import { RecintoRow } from "@/components/provincial/RecintoRow";
import { StatCard } from "@/components/provincial/StatCard";
import {
  BottomSheet,
  Button,
  EmptyState,
  Field,
  FilterChips,
  LoadingAnimation,
  Notice,
  Pill,
} from "@/components/ui";
import { nuevoRecintoSchema, type NuevoRecinto } from "@/domain/schemas/recinto";
import {
  estadoDeRecinto,
  type AvanceRecinto,
  type EstadoRecinto,
  type TableroProvincial,
} from "@/domain/schemas/seguimiento";
import { estadoRecintoVisual } from "@/presentation/provincial-ui";
import { territoryUseCases } from "@/presentation/territory";
import { useTableroProvincial } from "@/presentation/useTableroProvincial";
import { dignityLabel, formatSavedAt } from "@/presentation/veedor-ui";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

type Filtro = "todos" | EstadoRecinto;

/** Comparación sin tildes ni mayúsculas para el buscador. */
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function ProvincialRecintosScreen() {
  const { profile, tablero, error, loading, refreshing, refresh, reload } =
    useTableroProvincial();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [success, setSuccess] = useState("");

  const recintos = useMemo(() => tablero?.recintos ?? [], [tablero]);
  const contar = (estado: EstadoRecinto) =>
    recintos.filter((recinto) => estadoDeRecinto(recinto) === estado).length;

  const visibles = useMemo(() => {
    const termino = normalizar(busqueda.trim());
    return recintos.filter((recinto) => {
      if (filtro !== "todos" && estadoDeRecinto(recinto) !== filtro) return false;
      if (!termino) return true;
      return normalizar(`${recinto.nombre} ${recinto.parroquia} ${recinto.canton}`).includes(termino);
    });
  }, [recintos, busqueda, filtro]);

  const detalle = recintos.find((recinto) => recinto.id === detalleId) ?? null;
  const offline = Boolean(tablero?.guardadoEn);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <ScreenHeader
          eyebrow={profile?.provincia ?? "Coordinador provincial"}
          title="Recintos"
          subtitle="Avance de cada recinto de su provincia."
        />

        <View style={styles.body}>
          {error ? (
            <View style={styles.block}>
              <Notice tone="error">{error}</Notice>
              <Button variant="secondary" label="Reintentar" onPress={() => void reload()} />
            </View>
          ) : null}
          {success ? <Notice tone="success">{success}</Notice> : null}
          {tablero?.guardadoEn ? (
            <Notice tone="warning">
              Sin conexión. Datos guardados en el teléfono ({formatSavedAt(tablero.guardadoEn)}).
            </Notice>
          ) : null}

          {loading ? <LoadingAnimation message="Cargando los recintos de la provincia…" /> : null}

          {tablero ? (
            <>
              <Animated.View entering={FadeInDown.duration(360)} style={styles.search}>
                <Ionicons name="search" size={20} color={colors.textAuxiliary} />
                <TextInput
                  value={busqueda}
                  onChangeText={setBusqueda}
                  placeholder="Buscar recinto, parroquia o cantón"
                  placeholderTextColor={colors.textAuxiliary}
                  accessibilityLabel="Buscar recinto"
                  autoCorrect={false}
                  returnKeyType="search"
                  style={styles.searchInput}
                />
                {busqueda ? (
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={colors.textAuxiliary}
                    onPress={() => setBusqueda("")}
                    accessibilityLabel="Borrar búsqueda"
                  />
                ) : null}
              </Animated.View>

              <FilterChips<Filtro>
                value={filtro}
                onChange={setFiltro}
                options={[
                  { value: "todos", label: "Todos", count: recintos.length },
                  { value: "en_curso", label: "En curso", count: contar("en_curso") },
                  { value: "completo", label: "Completos", count: contar("completo") },
                  { value: "atencion", label: "Atención", count: contar("atencion") },
                  { value: "sin_iniciar", label: "Sin iniciar", count: contar("sin_iniciar") },
                ]}
              />

              {recintos.length === 0 ? (
                <EmptyState
                  title="Aún no hay recintos"
                  message="Registre el primer recinto de la provincia con el botón de abajo."
                />
              ) : visibles.length === 0 ? (
                <Animated.View entering={FadeIn.duration(250)}>
                  <Notice tone="info">Ningún recinto coincide con la búsqueda o el filtro.</Notice>
                </Animated.View>
              ) : (
                <View key={`${filtro}-${busqueda}`} style={styles.listCard}>
                  {visibles.map((recinto, index) => (
                    <RecintoRow
                      key={recinto.id}
                      recinto={recinto}
                      index={index}
                      last={index === visibles.length - 1}
                      onPress={() => setDetalleId(recinto.id)}
                    />
                  ))}
                </View>
              )}
            </>
          ) : null}
        </View>
      </ScrollView>

      {tablero ? (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.footer}>
          <Button
            label="Registrar recinto"
            icon={<Ionicons name="add" size={22} color={colors.onPrimary} />}
            disabled={offline || !profile?.provincia}
            onPress={() => {
              setSuccess("");
              setCreando(true);
            }}
          />
        </Animated.View>
      ) : null}

      <RecintoDetailSheet
        recinto={detalle}
        tablero={tablero}
        onClose={() => setDetalleId(null)}
      />
      {profile?.provincia ? (
        <NewRecintoSheet
          visible={creando}
          provincia={profile.provincia}
          onClose={() => setCreando(false)}
          onCreated={(nombre) => {
            setCreando(false);
            setSuccess(`El recinto ${nombre} se registró. Ya puede crear su coordinador.`);
            void reload();
          }}
        />
      ) : null}
    </View>
  );
}

function RecintoDetailSheet({
  recinto,
  tablero,
  onClose,
}: {
  recinto: AvanceRecinto | null;
  tablero: TableroProvincial | null;
  onClose: () => void;
}) {
  if (!recinto || !tablero) return null;
  const visual = estadoRecintoVisual[estadoDeRecinto(recinto)];
  const incidencias = tablero.ubicacionesActas.filter(
    (ubicacion) => ubicacion.recintoId === recinto.id && ubicacion.requiereRevision,
  );

  return (
    <BottomSheet visible onClose={onClose} closeLabel="Cerrar detalle del recinto">
      <View style={styles.sheetHeader}>
        <View style={styles.flex}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            {recinto.nombre}
          </Text>
          <Text style={styles.sheetSubtitle}>
            {recinto.parroquia} · {recinto.canton}
          </Text>
        </View>
        <Pill label={visual.label} tone={visual.tone} />
      </View>
      <View style={styles.statsRow}>
        <StatCard value={recinto.completas} label="Completas" color={colors.syncOkText} />
        <StatCard value={recinto.parciales} label="Parciales" color={colors.syncPendingText} />
        <StatCard value={recinto.pendientes} label="Sin actas" color={colors.textMuted} />
      </View>
      <Text style={styles.section}>UBICACIONES A REVISAR</Text>
      {incidencias.length === 0 ? (
        <Notice tone="success">Todas las actas se tomaron cerca del recinto.</Notice>
      ) : (
        incidencias.map((ubicacion) => (
          <View key={ubicacion.actaId} style={styles.incident}>
            <Ionicons name="location" size={20} color={colors.syncErrorText} />
            <Text style={styles.incidentText}>
              Mesa {ubicacion.numeroJrv} · {dignityLabel[ubicacion.dignidad]}: a{" "}
              {Math.round(ubicacion.distanciaM ?? 0)} m del recinto
            </Text>
          </View>
        ))
      )}
      <Button variant="ghost" label="Cerrar" onPress={onClose} />
    </BottomSheet>
  );
}

function NewRecintoSheet({
  visible,
  provincia,
  onClose,
  onCreated,
}: {
  visible: boolean;
  provincia: string;
  onClose: () => void;
  onCreated: (nombre: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const { control, handleSubmit, reset } = useForm<NuevoRecinto>({
    resolver: zodResolver(nuevoRecintoSchema),
    mode: "onTouched",
    defaultValues: { nombre: "", canton: "", parroquia: "" },
  });

  async function create(values: NuevoRecinto): Promise<void> {
    setSaving(true);
    setError("");
    try {
      await territoryUseCases.crearRecinto.execute(provincia, values);
      reset();
      onCreated(values.nombre);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "No fue posible registrar el recinto.",
      );
    } finally {
      setSaving(false);
    }
  }

  function close(): void {
    setError("");
    onClose();
  }

  const fields: { name: keyof NuevoRecinto; label: string }[] = [
    { name: "nombre", label: "Nombre del recinto" },
    { name: "canton", label: "Cantón" },
    { name: "parroquia", label: "Parroquia" },
  ];

  return (
    <BottomSheet visible={visible} onClose={close} closeLabel="Cerrar registro de recinto">
      <Text style={styles.sheetTitle} accessibilityRole="header">
        Registrar recinto
      </Text>
      <Text style={styles.sheetSubtitle}>Quedará dentro de {provincia}.</Text>
      {fields.map((item) => (
        <Controller
          key={item.name}
          control={control}
          name={item.name}
          render={({ field, fieldState }) => (
            <Field
              label={item.label}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              autoCapitalize="words"
              disabled={saving}
              shakeKey={shakeKey}
            />
          )}
        />
      ))}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button
        label="Registrar recinto"
        loading={saving}
        onPress={() => void handleSubmit(create, () => setShakeKey((value) => value + 1))()}
      />
      <Button variant="ghost" label="Cancelar" onPress={close} disabled={saving} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  flex: { flex: 1 },
  body: {
    alignSelf: "center",
    gap: 14,
    maxWidth: 620,
    paddingHorizontal: 20,
    paddingTop: 18,
    width: "100%",
  },
  block: { gap: 12 },
  search: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  searchInput: { color: colors.text, flex: 1, fontFamily: fonts.regular, fontSize: 16, minHeight: 48 },
  listCard: {
    backgroundColor: colors.paper,
    borderColor: colors.borderSoftBlue,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  footer: {
    backgroundColor: colors.paper,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sheetHeader: { alignItems: "center", flexDirection: "row", gap: 12 },
  sheetTitle: { color: colors.navy, fontFamily: fonts.bold, fontSize: 22 },
  sheetSubtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10 },
  section: {
    color: colors.textAuxiliary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 6,
  },
  incident: {
    alignItems: "center",
    backgroundColor: colors.syncErrorBg,
    borderColor: colors.syncErrorBorder,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  incidentText: { color: colors.syncErrorText, flex: 1, fontFamily: fonts.semiBold, fontSize: 14 },
});
