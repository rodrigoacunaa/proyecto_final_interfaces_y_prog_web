import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Home() {
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCourts = async () => {
      const q = query(collection(db, "courts"), where("available", "==", true));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCourts(data);
      setLoading(false);
    };
    fetchCourts();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  if (loading) return <p>Cargando canchas...</p>;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>CourtBook 🏟️</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(userRole === "owner" || userRole === "superadmin") && (
            <button onClick={() => navigate("/owner")}>Mi panel</button>
          )}
          {userRole === "client" && (
            <button onClick={() => navigate("/my-reservations")}>Mis reservas</button>
          )}
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>

      <h2>Canchas disponibles</h2>

      {courts.length === 0 ? (
        <p>No hay canchas disponibles por el momento.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {courts.map((court) => (
            <div key={court.id} style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1rem" }}>
              <h3>{court.name}</h3>
              <p>🏅 {court.sport}</p>
              <p>📍 {court.location}</p>
              <p>💰 ${court.price}/hora</p>
              <p>✅ Disponible</p>
              {court.ownerId !== user.uid && (
              <button onClick={() => navigate(`/reserve/${court.id}`)}>
                Reservar
              </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Home;