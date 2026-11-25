# Gestor de Actas de Escrutinio

Aplicación móvil (Expo + React Native) para el control electoral de una organización política: registro de actas de escrutinio por mesa, con evidencia fotográfica, ubicación GPS, funcionamiento sin conexión y seguimiento en tiempo real.

Examen I · Desarrollo de Aplicaciones Móviles.

## Roles

| Rol | Puede |
|---|---|
| Coordinador provincial | Crear coordinadores de recinto, gestionar recintos, ver el seguimiento provincial |
| Coordinador de recinto | Crear veedores, asignarlos a mesas, revisar y corregir actas del recinto |
| Veedor | Registrar y corregir las actas de sus mesas, también sin conexión |

No existe registro público: cada cuenta la crea el rol superior (ver `ADR-01-Autenticacion.md`).

## Puesta en marcha

```bash
npm install
cp .env.example .env   # completar EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start
```

Como la app usa módulos nativos (SQLite, Sentry, cámara), se ejecuta en un development build (`npx expo run:android`), no en Expo Go.

### Colores de la organización

Los colores de marca se eligen al compilar con `EXPO_PUBLIC_ORGANIZACION` (`ORG-01` azul, `ORG-02` violeta, `ORG-03` turquesa). Las paletas están en `src/theme/organizaciones.ts`; los colores de estado (guardado, pendiente, error) son comunes a todas para que su significado no cambie.

## Comandos

```bash
npx expo lint      # lint
npx tsc --noEmit   # chequeo de tipos
npm run build      # export para Android
```

## Estructura

```
src/
  app/            Rutas (Expo Router)
  components/ui/  Componentes del sistema de diseño (Uniwind)
  domain/         Casos de uso, esquemas Zod y reglas de negocio
  data/           Repositorios (Supabase, SQLite)
  presentation/   Composición de casos de uso para las pantallas
  theme/          Tokens de color, tipografía y temas por organización
supabase/
  migrations/     Tablas, RLS y RPC
  functions/      Edge Function crear-cuenta
```

## Documentación

- `Requerimientos_y_Supuestos.md`: requerimientos funcionales, no funcionales y supuestos.
- `ADR-Todas-Consolidadas.md`: decisiones de arquitectura.
- `Registro de Actas Veedor (1).pdf` y `session_pdf_pages/`: diseño de referencia de las pantallas.
