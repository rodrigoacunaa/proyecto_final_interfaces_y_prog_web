import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

function OwnerPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courts, setCourts] = useState([]);
  const [pendingReservations, setPendingReservations] = useState([]);
  const [confirmedReservations, setConfirmedReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("canchas");
  const [form, setForm] = useState({
    name: "",
    sport: "futbol",
    price: "",
    location: "",
  });

  const fetchMyCourts = async () => {
    const q = query(collection(db, "courts"), where("ownerId", "==", user.uid));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setCourts(data);
  };

  const fetchReservations = async () => {
    const pending = query(
      collection(db, "reservations"),
      where("ownerId", "==", user.uid),
      where("status", "==", "pending")
    );
    const confirmed = query(
      collection(db, "reservations"),
      where("ownerId", "==", user.uid),
      where("status", "==", "confirmed")
    );

    const [pendingSnap, confirmedSnap] = await Promise.all([
      getDocs(pending),
      getDocs(confirmed),
    ]);

    setPendingReservations(pendingSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    setConfirmedReservations(confirmedSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  };

  useEffect(() => {
    fetchMyCourts();
    fetchReservations();
  }, []);

  const handleConfirm = async (reservationId) => {
    await updateDoc(doc(db, "reservations", reservationId), {
      status: "confirmed",
    });
    fetchReservations();
  };

  const handleReject = async (reservationId) => {
    await updateDoc(doc(db, "reservations", reservationId), {
      status: "cancelled",
    });
    fetchReservations();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "courts"), {
      ...form,
      price: Number(form.price),
      available: true,
      ownerId: user.uid,
    });
    setForm({ name: "", sport: "futbol", price: "", location: "" });
    setShowForm(false);
    fetchMyCourts();
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const getCourtName = (courtId) => {
    const court = courts.find((c) => c.id === courtId);
    return court ? court.name : courtId;
  };

  if (loading) return <p>Cargando...</p>;

  const tabStyle = (tab) => ({
    padding: "0.5rem 1.5rem",
    cursor: "pointer",
    borderBottom: activeTab === tab ? "2px solid white" : "2px solid transparent",
    background: "none",
    color: "white",
    fontSize: "1rem",
  });

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>🏟️ Mi panel</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => navigate("/")}>Ver canchas</button>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #444", marginBottom: "1.5rem" }}>
        <button style={tabStyle("canchas")} onClick={() => setActiveTab("canchas")}>
          Mis canchas
        </button>
        <button style={tabStyle("pendientes")} onClick={() => setActiveTab("pendientes")}>
          Pendientes {pendingReservations.length > 0 && `(${pendingReservations.length})`}
        </button>
        <button style={tabStyle("confirmadas")} onClick={() => setActiveTab("confirmadas")}>
          Confirmadas
        </button>
      </div>

      {/* Tab: Mis canchas */}
      {activeTab === "canchas" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0 }}>Mis canchas</h2>
            <button onClick={() => setShowForm(!showForm)}>
              {showForm ? "Cancelar" : "+ Agregar cancha"}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
              <h3>Nueva cancha</h3>
              <input placeholder="Nombre de la cancha" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ display: "block", width: "100%", marginBottom: "0.5rem", padding: "0.5rem" }} />
              <select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} style={{ display: "block", width: "100%", marginBottom: "0.5rem", padding: "0.5rem" }}>
                <option value="futbol">Fútbol</option>
                <option value="padel">Pádel</option>
                <option value="tenis">Tenis</option>
                <option value="basquet">Básquet</option>
              </select>
              <input placeholder="Precio por hora" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required style={{ display: "block", width: "100%", marginBottom: "0.5rem", padding: "0.5rem" }} />
              <input placeholder="Ubicación" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required style={{ display: "block", width: "100%", marginBottom: "0.5rem", padding: "0.5rem" }} />
              <button type="submit" style={{ padding: "0.5rem 1rem" }}>Guardar cancha</button>
            </form>
          )}

          {courts.length === 0 ? (
            <p>Todavía no tenés canchas cargadas.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {courts.map((court) => (
                <div key={court.id} style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1rem" }}>
                  <h3>{court.name}</h3>
                  <p>🏅 {court.sport}</p>
                  <p>📍 {court.location}</p>
                  <p>💰 ${court.price}/hora</p>
                  <p>{court.available ? "✅ Disponible" : "❌ No disponible"}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab: Pendientes */}
      {activeTab === "pendientes" && (
        <>
          <h2>Reservas pendientes</h2>
          {pendingReservations.length === 0 ? (
            <p>No hay reservas pendientes.</p>
          ) : (
            pendingReservations.map((res) => (
              <div key={res.id} style={{ border: "1px solid #f0a500", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
                <p>🏟️ <strong>{getCourtName(res.courtId)}</strong></p>
                <p>👤 {res.clientName}</p>
                <p>📅 {res.date} a las {res.startTime}hs</p>
                <p>⏳ Estado: <strong>Pendiente de pago</strong></p>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    onClick={() => handleConfirm(res.id)}
                    style={{ padding: "0.5rem 1rem", backgroundColor: "#2a7", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
                  >
                    ✅ Confirmar pago
                  </button>
                  <button
                    onClick={() => handleReject(res.id)}
                    style={{ padding: "0.5rem 1rem", backgroundColor: "#c00", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
                  >
                    ❌ Rechazar
                  </button>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* Tab: Confirmadas */}
      {activeTab === "confirmadas" && (
        <>
          <h2>Reservas confirmadas</h2>
          {confirmedReservations.length === 0 ? (
            <p>No hay reservas confirmadas aún.</p>
          ) : (
            confirmedReservations.map((res) => (
              <div key={res.id} style={{ border: "1px solid #2a7", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
                <p>🏟️ <strong>{getCourtName(res.courtId)}</strong></p>
                <p>👤 {res.clientName}</p>
                <p>📅 {res.date} a las {res.startTime}hs</p>
                <p>✅ Estado: <strong>Confirmada</strong></p>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

export default OwnerPanel;