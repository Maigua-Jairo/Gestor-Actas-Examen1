import { Component, useEffect, useRef, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import LottieView from "lottie-react-native";
import { useReducedMotion } from "react-native-reanimated";

/** Animaciones de la app (assets/lottie). */
const SOURCES = {
  /** Ingreso exitoso. */
  signIn: require("../../../assets/lottie/sign-in.json"),
  /** Acción completada: acta enviada, cuenta creada, clave guardada… */
  success: require("../../../assets/lottie/success.json"),
  /** Todavía no hay datos. */
  noData: require("../../../assets/lottie/no-data.json"),
  /** Carga de pantallas con muchos datos. */
  loading: require("../../../assets/lottie/loading.json"),
} as const;

export type LottieName = keyof typeof SOURCES;

export type LottieAnimationProps = {
  name: LottieName;
  size: number;
  loop?: boolean;
  speed?: number;
  /** Se llama al terminar, o de inmediato si la animación no se puede mostrar. */
  onFinish?: () => void;
  /** Se muestra si Lottie no está disponible (por ejemplo, APK sin recompilar). */
  fallback?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Animación Lottie con dos protecciones: respeta "reducir movimiento" del
 * sistema (muestra el cuadro final) y, si el módulo nativo no está, muestra
 * el respaldo y avisa que terminó para no bloquear el flujo.
 */
export function LottieAnimation({
  name,
  size,
  loop = false,
  speed = 1,
  onFinish,
  fallback = null,
  style,
}: LottieAnimationProps) {
  const reduceMotion = useReducedMotion();
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onFinish?.();
  };

  // Sin movimiento: la animación no corre, así que se considera terminada.
  useEffect(() => {
    if (reduceMotion && onFinish && !finished.current) {
      finished.current = true;
      onFinish();
    }
  }, [reduceMotion, onFinish]);

  return (
    <View
      style={[{ height: size, width: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LottieBoundary fallback={fallback} onError={finish}>
        <LottieView
          source={SOURCES[name]}
          autoPlay={!reduceMotion}
          loop={loop && !reduceMotion}
          speed={speed}
          progress={reduceMotion ? 1 : undefined}
          resizeMode="contain"
          onAnimationFinish={(cancelled) => {
            if (!cancelled) finish();
          }}
          onAnimationFailure={finish}
          style={{ height: size, width: size }}
        />
      </LottieBoundary>
    </View>
  );
}

/** Si la vista nativa de Lottie no existe, muestra el respaldo en lugar de cerrar la app. */
class LottieBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
