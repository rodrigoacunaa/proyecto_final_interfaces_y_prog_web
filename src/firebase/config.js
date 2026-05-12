import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Datos de firebase (configurar con .env para prod o con .env.development para testing)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Inicializamos la App
const app = initializeApp(firebaseConfig);

// Inicializamos analitics
export const analytics = getAnalytics(app);

// Exportamos las herramientas que usamos en el proyecto
export const auth = getAuth(app);
export const db = getFirestore(app);

// Activa persistencia offline con IndexedDB:
// Firestore guarda una copia local de los documentos consultados en el navegador.
// En visitas siguientes, los datos se muestran instantaneamente desde el cache
// mientras en segundo plano se sincronizan los cambios con el servidor.
// Si no hay conexion, la app sigue funcionando con los ultimos datos guardados.
enableIndexedDbPersistence(db).catch(() => {});

export default app;