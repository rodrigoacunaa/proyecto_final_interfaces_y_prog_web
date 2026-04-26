import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Tus datos de Firebase (Testing propio)
const firebaseConfig = {
<<<<<<< Updated upstream
  apiKey: "AIzaSyCqW-YicrdLtECArLfnSzItzursk7tjjyM",
  authDomain: "reservacanchas-a383c.firebaseapp.com",
  projectId: "reservacanchas-a383c",
  storageBucket: "reservacanchas-a383c.firebasestorage.app",
  messagingSenderId: "453571768825",
  appId: "1:453571768825:web:73560a66fc00fecf0b4d28",
  measurementId: "G-PTRSB2TW5S"
=======
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
>>>>>>> Stashed changes
};

// Inicializamos la App
const app = initializeApp(firebaseConfig);

<<<<<<< Updated upstream
// Exportamos lo que el resto de la app necesita
=======
// Inicializamos analitics
export const analytics = getAnalytics(app);

// Exportamos las herramientas que usamos en el proyecto
export const auth = getAuth(app);
>>>>>>> Stashed changes
export const db = getFirestore(app);

export default app;