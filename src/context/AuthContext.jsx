// createContext para crear el contexto global de auth, useEffect para suscribirse a Firebase,
// useState para almacenar el usuario y su rol
import { createContext, useContext, useEffect, useState } from "react";
// onAuthStateChanged es el listener de Firebase que se dispara cada vez que cambia el estado de sesion
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/config";
// getDoc para leer el doc del usuario en Firestore, setDoc para crearlo si es la primera vez
import { doc, getDoc, setDoc } from "firebase/firestore";

// Contexto global que expone user, userRole, loading y setUser a toda la app
const AuthContext = createContext();

export function AuthProvider({ children }) {
  // user: objeto combinado con datos de Firebase Auth + datos de Firestore (rol, whatsapp, etc.)
  const [user, setUser] = useState(null);
  // userRole: se guarda separado para facilitar las guardas de ruta (PrivateRoute, OwnerRoute, etc.)
  const [userRole, setUserRole] = useState(null);
  // loading: bloquea el render de los children hasta que se resuelva el estado de sesion inicial
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChanged devuelve una funcion de cleanup que cancela la suscripcion al desmontar
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserRole(userData.role);
          // Fusionamos los datos de Firebase Auth (uid, email, photoURL, etc.) con los de Firestore
          // (role, whatsapp, name) en un solo objeto para no tener que acceder a dos fuentes distintas
          setUser({ ...currentUser, ...userData });
        } else {
          // Usuario nuevo: el doc en Firestore todavia no existe
          // Esperamos 500ms y hacemos reload() para capturar el displayName que updateProfile()
          // escribe en Firebase Auth justo antes de llegar aqui desde el flujo de registro
          await new Promise((resolve) => setTimeout(resolve, 500));
          await currentUser.reload();

          const newUserDoc = {
            name: currentUser.displayName,
            email: currentUser.email,
            role: "client", // todos los usuarios nuevos arrancan como clientes
            whatsapp: "",
            photoURL: currentUser.photoURL || ""
          };

          // Creamos el doc en Firestore con setDoc usando el uid como ID de documento
          await setDoc(userRef, newUserDoc);
          setUserRole("client");
          setUser({ ...currentUser, ...newUserDoc });
        }
      } else {
        // No hay sesion activa (logout o primer acceso sin login)
        setUser(null);
        setUserRole(null);
      }
      // El loading se apaga aqui, despues de procesar el usuario, para evitar que los children
      // rendericen con user=null un instante antes de que se resuelva el estado real
      setLoading(false);
    });

    // Limpiamos la suscripcion al desmontar el provider para evitar fugas de memoria
    return () => unsubscribe();
  }, []);

  return (
    // setUser se expone para que componentes como Navbar puedan actualizar el contexto
    // sin provocar un re-fetch a Firestore (ej: al editar el whatsapp del dueno)
    <AuthContext.Provider value={{ user, userRole, loading, setUser }}>
      {/* Bloqueamos el render de los children hasta tener el estado de sesion resuelto
          para evitar flasheos de rutas incorrectas o redirects prematuros */}
      {!loading && children}
    </AuthContext.Provider>
  );
}

// Hook de acceso al contexto — lanza un error claro si se usa fuera del AuthProvider
export function useAuth() {
  return useContext(AuthContext);
}
