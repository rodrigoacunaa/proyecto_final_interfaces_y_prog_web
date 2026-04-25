import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Tus datos de Firebase (Testing propio)
const firebaseConfig = {
  apiKey: "AIzaSyCqW-YicrdLtECArLfnSzItzursk7tjjyM",
  authDomain: "reservacanchas-a383c.firebaseapp.com",
  projectId: "reservacanchas-a383c",
  storageBucket: "reservacanchas-a383c.firebasestorage.app",
  messagingSenderId: "453571768825",
  appId: "1:453571768825:web:73560a66fc00fecf0b4d28",
  measurementId: "G-PTRSB2TW5S"
};

const app = initializeApp(firebaseConfig);

// Exportamos lo que el resto de la app necesita
export const db = getFirestore(app);
export const auth = getAuth(app);