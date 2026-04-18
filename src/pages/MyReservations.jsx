import { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";

function MyReservations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [courts, setCourts] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchReservations = async () => {
    const q = query(collection(db, "reservations"), where("clientId", "==", user.uid));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Traer los nombres de las canchas
    const courtIds = [...new Set(data.map((r) => r.courtId))];
    const courtData = {};
    for (const courtId of courtIds) {
      const courtSnap = await getDocs(query(collection(db, "courts"), where("__name__", "==", courtId)));
      courtSnap.docs.forEach((d) => { courtData[d.id] = d.data(); });
    }

    setCourts(courtData);
    setReservations(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    setLoading(false);
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  const handleCancel = async (reservationId) => {
    await updateDoc(doc(db, "reservations", reservationId), {
      status: "cancelled",
    });
    fetchReservations();
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const statusLabel = (status) => {
    if (status === "pending") return { text: "⏳ Pendiente de pago", color: "#f0a500" };
    if (status === "confirmed") return { text: "✅ Confirmada", color: "#2a7" };
    if (status === "cancelled") return { text: "❌ Cancelada", color: "#c00" };
    return { text: status, color: "white" };
  };

  if (loading) return <p>Cargando tus reservas...</p>;

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>📋 Mis reservas</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => navigate("/")}>← Volver</button>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>

      {reservations.length === 0 ? (
        <p>Todavía no hiciste ninguna reserva.</p>
      ) : (
        reservations.map((res) => {
          const court = courts[res.courtId];
          const status = statusLabel(res.status);
          return (
            <div key={res.id} style={{ border: `1px solid ${status.color}`, borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
              <h3>{court ? court.name : "Cancha"}</h3>
              <p>📅 {res.date} a las {res.startTime}hs</p>
              <p>📍 {court ? court.location : ""}</p>
              <p>💰 ${court ? court.price : ""}/hora</p>
              <p style={{ color: status.color }}>{status.text}</p>
              {res.status === "pending" && (
                <button
                  onClick={() => handleCancel(res.id)}
                  style={{ marginTop: "0.5rem", padding: "0.5rem 1rem", backgroundColor: "#c00", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
                >
                  Cancelar reserva
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default MyReservations;