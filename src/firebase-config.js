/**
 * ── Configuración de Firebase (OPCIONAL) ─────────────────────────────────
 *
 * Sin esto la app funciona igual, pero la colección se guarda solo en el
 * navegador de cada dispositivo. Con Firebase configurado aparece el botón
 * "Entrar con Google" y la colección se sincroniza entre todos tus
 * dispositivos.
 *
 * Cómo obtener estos valores (gratis, ~10 minutos):
 *   1. Entrá a https://console.firebase.google.com y creá un proyecto.
 *   2. Agregá una "app web" (ícono </>) → te muestra el firebaseConfig.
 *   3. Copiá esos valores acá abajo reemplazando el `null`.
 *   4. En Authentication → Sign-in method → habilitá "Google".
 *   5. En Authentication → Settings → Authorized domains → agregá tu dominio
 *      de GitHub Pages (ej: renzobarrionuevo.github.io).
 *   6. En Firestore Database → creá la base (modo producción) y en la
 *      pestaña "Rules" pegá las reglas que están en el README.
 *
 * Estos valores NO son secretos (identifican tu proyecto públicamente;
 * la seguridad la dan las reglas de Firestore y los dominios autorizados).
 */

// Reemplazá `null` por tu configuración, por ejemplo:
// export const firebaseConfig = {
//   apiKey: 'AIzaSy...',
//   authDomain: 'tcg-vault-xxxxx.firebaseapp.com',
//   projectId: 'tcg-vault-xxxxx',
//   storageBucket: 'tcg-vault-xxxxx.firebasestorage.app',
//   messagingSenderId: '123456789',
//   appId: '1:123456789:web:abc123',
// }
export const firebaseConfig = {
  apiKey: "AIzaSyAXnkpS0rojn9h1EiYHV4QkbXI-L3d-fC4",
  authDomain: "tcg-vault-905a8.firebaseapp.com",
  projectId: "tcg-vault-905a8",
  storageBucket: "tcg-vault-905a8.firebasestorage.app",
  messagingSenderId: "1029915700732",
  appId: "1:1029915700732:web:27ff10119d7c2ee9f45679"
};