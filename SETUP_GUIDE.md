# 🏗️ Invoice SaaS — Monorepo Setup Guide

## Arquitectura final

```
invoice-saas/                  ← raíz del monorepo
├── apps/
│   ├── web/                   ← tu Next.js actual (mueves todo aquí)
│   └── mobile/                ← nueva app Expo
├── packages/
│   ├── lib/                   ← hooks + supabase client compartidos
│   └── types/                 ← tipos TypeScript compartidos
├── package.json               ← scripts raíz
├── pnpm-workspace.yaml        ← define los workspaces
├── turbo.json                 ← pipeline de builds
└── tsconfig.base.json         ← TypeScript base compartido
```

---

## 📋 Paso 1 — Reestructurar el repo existente

Desde la raíz de tu repo actual, ejecuta:

```bash
# Crea las carpetas del monorepo
mkdir -p apps/web apps/mobile packages/lib/src/supabase packages/lib/src/hooks packages/types/src

# Mueve TODO tu código actual a apps/web
# (asegúrate de estar en la raíz del repo)
mv app components hooks lib public scripts styles \
   components.json middleware.ts next.config.mjs \
   next-env.d.ts postcss.config.mjs tailwind.config.* \
   tsconfig.json apps/web/

# Mueve el package.json del web (el tuyo actual pero renombrado)
mv package.json apps/web/package.json
```

---

## 📋 Paso 2 — Archivos en la raíz del monorepo

Copia estos archivos (incluidos en esta guía) a la raíz:

- `package.json`           → raíz del monorepo
- `pnpm-workspace.yaml`    → define workspaces
- `turbo.json`             → pipeline Turborepo
- `tsconfig.base.json`     → TypeScript base
- `.gitignore`             → actualizado para monorepo

**Edita `apps/web/package.json`:**
- Cambia `"name": "my-project"` → `"name": "web"`
- Agrega estas dependencias internas:
```json
"@invoice-saas/lib": "workspace:*",
"@invoice-saas/types": "workspace:*"
```

---

## 📋 Paso 3 — Copiar archivos de la app móvil

Copia la carpeta `apps/mobile/` completa con toda la estructura:

```
apps/mobile/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx
│   └── (app)/
│       ├── _layout.tsx
│       └── dashboard.tsx
├── context/
│   ├── auth-context.tsx
│   └── theme-context.tsx
├── app.json
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
├── global.css
├── tsconfig.json
└── package.json
```

---

## 📋 Paso 4 — Copiar los packages compartidos

```
packages/
├── lib/
│   ├── src/
│   │   ├── supabase/client.ts
│   │   ├── hooks/use-invoices.ts
│   │   ├── hooks/use-clients.ts
│   │   └── index.ts
│   └── package.json
└── types/
    ├── src/index.ts
    └── package.json
```

---

## 📋 Paso 5 — Variables de entorno

**apps/web/.env.local** (ya lo tenías):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**apps/mobile/.env** (nuevo):
```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 📋 Paso 6 — Actualizar imports en apps/web

En tus archivos de `apps/web`, reemplaza los imports de lib y hooks:

```typescript
// ANTES (ruta local)
import { createClient } from "@/lib/supabase/client"
import { useInvoices } from "@/hooks/use-invoices"

// DESPUÉS (package compartido)
import { supabase } from "@invoice-saas/lib"
import { useInvoices } from "@invoice-saas/lib"
```

> ⚠️ Solo para los hooks/utils que quieras compartir con móvil.
> Los componentes UI de shadcn se quedan en `apps/web/components`.

---

## 📋 Paso 7 — Instalar dependencias

```bash
# Desde la RAÍZ del monorepo
pnpm install
```

Esto instala todo en el monorepo de forma optimizada.

---

## 📋 Paso 8 — Verificar que todo funciona

```bash
# Arrancar todo en paralelo
pnpm dev

# Solo web
pnpm dev:web

# Solo móvil
pnpm dev:mobile
```

---

## 🔄 Qué se comparte vs qué es independiente

| | Web (Next.js) | Móvil (Expo) |
|---|---|---|
| **Supabase client** | ✅ `@invoice-saas/lib` | ✅ `@invoice-saas/lib` |
| **Hooks de datos** | ✅ `useInvoices`, `useClients` | ✅ mismo |
| **Tipos TS** | ✅ `@invoice-saas/types` | ✅ mismo |
| **Lógica de negocio** | ✅ `@invoice-saas/lib` | ✅ mismo |
| **Componentes UI** | ❌ shadcn/Radix (web only) | ❌ NativeWind components |
| **Routing** | ❌ Next.js App Router | ❌ Expo Router |
| **Autenticación** | ❌ `@supabase/ssr` | ❌ `auth-context.tsx` |

---

## 📱 Próximos pasos para el móvil

1. **Pantallas restantes**: crear `invoices.tsx`, `clients.tsx`, `settings.tsx`
2. **Formulario nueva factura**: adaptar tu form de Next.js con `react-hook-form` + NativeWind
3. **Generación de PDF**: usar `expo-print` + `expo-sharing` (equivalente a tu web)
4. **Push notifications**: `expo-notifications` para alertas de facturas vencidas

---

## ❓ Troubleshooting frecuente

**Error: "Cannot find module '@invoice-saas/lib'"**
→ Ejecuta `pnpm install` desde la raíz

**Metro no encuentra los packages del monorepo**
→ Verifica que `metro.config.js` tenga `watchFolders` apuntando a la raíz

**NativeWind clases no aplican**
→ Asegúrate de importar `global.css` en `_layout.tsx`
