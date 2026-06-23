# 📱 Build de la app móvil (Archivum)

App Expo (SDK 55) con expo-router. Los builds se generan con **EAS Build** (servicio de
compilación en la nube de Expo). Toda esta config vive en `eas.json`.

## Perfiles de build (`eas.json`)

| Perfil | Para qué sirve | Salida | Distribución |
|---|---|---|---|
| `development` | Desarrollo con dev client + hot reload sobre build nativa | APK (Android) / simulador (iOS) | Interna |
| `preview` | Probar en dispositivos reales antes de publicar | APK instalable | Interna |
| `production` | Subir a las tiendas | AAB (Play) / IPA (App Store) | Tiendas |

## Requisitos (solo la primera vez)

1. **Cuenta de Expo** — crea una en https://expo.dev si no la tienes.
2. **Login**:
   ```bash
   cd apps/mobile
   pnpm exec eas login
   ```
3. **Vincular el proyecto** (genera `extra.eas.projectId` y `owner` en `app.json`):
   ```bash
   pnpm exec eas init
   ```

## Variables de entorno (Supabase)

La app necesita estas variables **en tiempo de build**:

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

En local viven en `apps/mobile/.env.local` (ver `.env.example`). Para los builds de EAS,
regístralas como variables de entorno del proyecto (no se commitean):

```bash
pnpm exec eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxx.supabase.co" --environment production
pnpm exec eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon-key>" --environment production
```

(Repite con `--environment preview` / `development` según el perfil que vayas a compilar.)

## Comandos de build

Desde `apps/mobile/`:

```bash
pnpm build:dev:android     # dev client Android (APK)
pnpm build:dev:ios         # dev client iOS (simulador)
pnpm build:preview         # APK de prueba (Android)
pnpm build:preview:ios     # build interna iOS
pnpm build:prod            # producción Android + iOS
pnpm submit:prod           # subir a las tiendas
```

## Notas

- `appVersionSource: "remote"` + `autoIncrement` (perfil production) → EAS gestiona
  automáticamente `versionCode` (Android) y `buildNumber` (iOS).
- `runtimeVersion.policy = "appVersion"` en `app.json` ata el runtime a la versión de la app
  (relevante para OTA updates con EAS Update).
- iOS de producción requiere credenciales de Apple Developer (EAS las gestiona de forma
  interactiva la primera vez).
- `pnpm doctor` ejecuta `expo-doctor` para validar la salud del proyecto antes de compilar.
