# 🃏 TCG Vault

App web para registrar tu colección de cartas de **Pokémon TCG** y **One Piece Card Game**, con **precios de mercado de TCGPlayer actualizados a diario**. Corre 100% gratis en **GitHub Pages** — sin servidores, sin base de datos, sin API keys obligatorias.

## Qué hace

- **Registrar cartas** pegando la **URL de tcgplayer.com** (ej: `https://www.tcgplayer.com/product/543603/...`), el **código de la carta** (`OP01-001`, `ST13-003` para One Piece; `sv4-123` para Pokémon) o buscando por **nombre**.
- **Precios de TCGPlayer** (market / low / high) por variante (Normal, Foil, Holofoil, Reverse Holo…), regenerados **una vez por día** automáticamente.
- Por cada carta: cantidad, condición (NM/LP/MP/HP/DMG), variante, precio pagado y **ganancia/pérdida** contra el precio de mercado actual.
- Totales de la colección: cartas, invertido, valor de mercado y G/P.
- **Respaldo**: exportar/importar tu colección como JSON.

## Cómo funciona (arquitectura)

```
GitHub Actions (diario, 07:00 UTC)
  └─ scripts/fetch-data.mjs
       └─ descarga catálogo + precios oficiales de TCGPlayer desde tcgcsv.com
          (Pokémon = categoría 3, One Piece = categoría 68)
       └─ genera JSON estáticos en public/data/ (shards por productId + índice One Piece)
  └─ vite build  →  deploy a GitHub Pages

La app (React) lee esos JSON desde su propio origen (sin CORS) y además
consulta pokemontcg.io para búsquedas de Pokémon por nombre/código.
Tu colección se guarda en el localStorage de tu navegador.
```

## Publicarla en GitHub Pages (paso a paso)

1. Creá un repositorio nuevo en GitHub (por ejemplo `tcg-vault`). Público o privado, ambos sirven (Pages con repo privado requiere plan Pro).
2. Subí este código:

   ```bash
   cd tcg-vault
   git init
   git add .
   git commit -m "TCG Vault"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/tcg-vault.git
   git push -u origin main
   ```

3. En GitHub: **Settings → Pages → Build and deployment → Source** y elegí **GitHub Actions**.
4. Andá a la pestaña **Actions**, seleccioná el workflow **Build & Deploy (GitHub Pages)** y tocá **Run workflow** (o simplemente hacé otro push). La primera corrida tarda unos minutos porque descarga todo el catálogo de precios.
5. Listo: tu app queda en `https://TU_USUARIO.github.io/tcg-vault/` y **los precios se actualizan solos todos los días** con el cron del workflow.

> Nota: los workflows con `schedule` se pausan si el repo pasa 60 días sin actividad. Con entrar cada tanto o tocar "Run workflow" se reactiva.

## Desarrollo local

```bash
npm install
npm run fetch-data   # descarga los datos de precios (tarda unos minutos)
npm run dev          # abre la app en http://localhost:5173
npm test             # tests de parsing y almacenamiento
```

Para probar el pipeline con un solo set: `node scripts/fetch-data.mjs --only-group 68:23349`

## Importante: dónde viven tus datos

Sin iniciar sesión, tu colección se guarda **en el navegador que uses** (localStorage). Si limpiás los datos del navegador o cambiás de dispositivo, usá **Ajustes → Exportar JSON** para respaldar y **Importar** para restaurar.

Con la sincronización activada (ver siguiente sección), al **entrar con Google** la colección se guarda además en la nube (Firestore) y se mantiene igual en todos tus dispositivos, en tiempo real.

## Sincronización entre dispositivos (login con Google) — opcional y gratis

Usa **Firebase** (plan gratuito Spark, no pide tarjeta). Pasos, una sola vez:

1. **Crear el proyecto**: entrá a [console.firebase.google.com](https://console.firebase.google.com) con tu cuenta de Google → **Add project / Crear proyecto** → nombre (ej: `tcg-vault`) → podés desactivar Analytics → Crear.
2. **Registrar la app web**: en la pantalla principal del proyecto tocá el ícono **`</>`** (Web) → nombre cualquiera → **Register app**. Te muestra un bloque `const firebaseConfig = { apiKey: ..., authDomain: ..., ... }` — **copiá esos valores**.
3. **Pegar la config**: en tu repo de GitHub editá el archivo `src/firebase-config.js` y reemplazá `export const firebaseConfig = null` por tu objeto (el archivo tiene un ejemplo comentado del formato exacto).
4. **Habilitar Google como método de acceso**: en la consola de Firebase → **Build → Authentication → Get started → Sign-in method → Google → Enable** (elegí tu email de soporte) → Save.
5. **Autorizar tu dominio**: en **Authentication → Settings → Authorized domains → Add domain** → agregá `TU_USUARIO.github.io`.
6. **Crear la base de datos**: **Build → Firestore Database → Create database** → modo producción → listo. Después, en la pestaña **Rules**, pegá esto y tocá **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /vaults/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

   (Estas reglas hacen que cada usuario solo pueda leer y escribir SU colección.)

7. Commit del cambio en `src/firebase-config.js` → el workflow redeploya solo → aparece el botón **«Entrar con Google»** en la app.

Los valores del `firebaseConfig` no son secretos: identifican al proyecto públicamente y la seguridad la dan las reglas de Firestore y la lista de dominios autorizados.

> Límite del plan gratuito: de sobra para uso personal (50.000 lecturas/día). La colección se guarda como un documento por usuario; hasta ~3.000 cartas por cuenta.

## API key opcional (Pokémon)

Sin key, pokemontcg.io permite 1.000 consultas/día (de sobra para uso personal). Si querés más, registrate gratis en [dev.pokemontcg.io](https://dev.pokemontcg.io) y pegá la key en **Ajustes** — se guarda solo en tu navegador.

## Fuentes de datos

- [tcgcsv.com](https://tcgcsv.com) — dumps diarios del catálogo y precios de TCGPlayer.
- [pokemontcg.io](https://pokemontcg.io) — datos y precios TCGPlayer de cartas Pokémon.

Este proyecto no está afiliado a TCGPlayer, Pokémon ni Bandai.
