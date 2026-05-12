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
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserRole(userData.role);
          // Combinamos los datos de Auth y de Firestore en un solo estado
          setUser({ ...currentUser, ...userData }); 
        } else {
          // Si es usuario nuevo
          await new Promise((resolve) => setTimeout(resolve, 500));
          await currentUser.reload();
          
          const newUserDoc = {
            name: currentUser.displayName,
            email: currentUser.email,
            role: "client",
            whatsapp: "",
            photoURL: currentUser.photoURL || ""
          };

          await setDoc(userRef, newUserDoc);
          setUserRole("client");
          setUser({ ...currentUser, ...newUserDoc });
        }
      } else {
        // Si no hay sesión activa
        setUser(null);
        setUserRole(null);
      }
      // Movimos el loading acá para que termine solo después de procesar todo
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userRole, loading, setUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}