import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Buscar el documento del usuario en Firestore
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          // Usuario ya existe, traer su rol
          setUserRole(userSnap.data().role);
        } else {
            // Se le da medio segundo a updateProfile para que llegue antes
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Despues de la espera, le pedimos a Firebase que recargue los datos del usuario con name actualizado
          await currentUser.reload();
          // Usuario nuevo, crear documento con rol client
          await setDoc(userRef, {
            name: currentUser.displayName, //nombre
            email: currentUser.email, //email
            role: "client", //rol del usuario
          });
          setUserRole("client");
        }
        setUser(currentUser);
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userRole, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}