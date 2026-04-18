import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

const HORARIOS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

function Reserve() {
  const { courtId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [court, setCourt] = useState(null);
  const [date, setDate] = useState("");
  const [reservedSlots, setReservedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchCourt = async () => {
      const docRef = doc(db, "courts", courtId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setCourt({ id: docSnap.id, ...docSnap.data() });
      setLoading(false);
    };
    fetchCourt();
  }, [courtId]);

  const fetchReservedSlots = async (selectedDate) => {
    const q = query(
      collection(db, "reservations"),
      where("courtId", "==", courtId),
      where("date", "==", selectedDate),
      where("status", "==", "confirmed")
    );
    const snapshot = await getDocs(q);
    const slots = snapshot.docs.map((doc) => doc.data().startTime);
    setReservedSlots(slots);
  };

  const handleDateChange = (e) => {
    setDate(e.target.value);
    fetchReservedSlots(e.target.value);
  };

  const handleReserve = async (startTime) => {
  // Crear reserva como pendiente
  await addDoc(collection(db, "reservations"), {
    courtId,
    clientId: user.uid,
    clientName: user.displayName || user.email,
    ownerId: court.ownerId,
    date,
    startTime,
    endTime: HORARIOS[HORARIOS.indexOf(startTime) + 1] || "21:00",
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  // Buscar el WhatsApp del dueño
  const ownerRef = doc(db, "users", court.ownerId);
  const ownerSnap = await getDoc(ownerRef);
  const ownerData = ownerSnap.data();

  // Armar el mensaje
  const mensaje = `Hola! Quiero reservar *${court.name}* para el *${date}* a las *${startTime}hs*. Mi nombre es ${user.displayName || user.email}. Quedo esperando el alias para confirmar el pago. ¡Gracias!`;

  // Abrir WhatsApp
  const url = `https://api.whatsapp.com/send?phone=${ownerData.whatsapp}&text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");

  setSuccess(true);
  fetchReservedSlots(date);
};

  if (loading) return <p>Cargando...</p>;
  if (!court) return <p>Cancha no encontrada.</p>;

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "2rem" }}>
      <button onClick={() => navigate("/")}>← Volver</button>
      <h1>{court.name}</h1>
      <p>📍 {court.location} · 💰 ${court.price}/hora</p>

      <h2>Elegí una fecha</h2>
      <input
        type="date"
        value={date}
        onChange={handleDateChange}
        min={new Date().toISOString().split("T")[0]}
        style={{ padding: "0.5rem", marginBottom: "1rem" }}
      />

      {success && (
        <p style={{ color: "green" }}>
            ✅ ¡Solicitud enviada! El dueño te va a confirmar por WhatsApp una vez que reciba el pago.
        </p>
        )}

      {date && (
        <>
          <h2>Horarios disponibles</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
            {HORARIOS.map((hora) => {
              const isReserved = reservedSlots.includes(hora);
              return (
                <button
                  key={hora}
                  onClick={() => !isReserved && handleReserve(hora)}
                  disabled={isReserved}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "8px",
                    cursor: isReserved ? "not-allowed" : "pointer",
                    backgroundColor: isReserved ? "#555" : "#2a7",
                    color: "white",
                    border: "none",
                  }}
                >
                  {hora} {isReserved ? "❌" : "✅"}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default Reserve;