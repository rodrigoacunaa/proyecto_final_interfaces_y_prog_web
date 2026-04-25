import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

function OwnerPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  //canchas del dueño
  const [courts, setCourts] = useState([]);

  //reservas pendientes
  const [pendingReservations, setPendingReservations] = useState([]);

  //reservas confirmadas
  const [confirmedReservations, setConfirmedReservations] = useState([]);

  const [loading, setLoading] = useState(true);

  //se muestra el form de nueva cancha?
  const [showForm, setShowForm] = useState(false);

  //qué pestaña está activa?
  const [activeTab, setActiveTab] = useState("canchas");

  //valores del form "nueva cancha"
  const [form, setForm] = useState({ name: "", sport: "futbol", price: "", location: "" });

  const fetchMyCourts = async () => {
    //solo se muestran las canchas que coinciden con el id del dueño
    const q = query(collection(db, "courts"), where("ownerId", "==", user.uid));
    
    //se traen todas las canchas 
    const snapshot = await getDocs(q);
    setCourts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  const fetchReservations = async () => {
    //traemos la fecha de hoy
    let fecha = new Date().toISOString().split("T")[0]
    const [pendingSnap, confirmedSnap] = await Promise.all([
      //comparamos con la fecha de hoy para tener solo reservas del día
      getDocs(query(collection(db, "reservations"), where("ownerId", "==", user.uid), where("status", "==", "pending"), where("date", "==", fecha))),
      getDocs(query(collection(db, "reservations"), where("ownerId", "==", user.uid), where("status", "==", "confirmed"))),
    ]);
    setPendingReservations(pendingSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    setConfirmedReservations(confirmedSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  };

  useEffect(() => { fetchMyCourts(); fetchReservations(); }, []);

  const handleConfirm = async (id) => {
    await updateDoc(doc(db, "reservations", id), { status: "confirmed" });
    fetchReservations();
  };

  const handleReject = async (id) => {
    await updateDoc(doc(db, "reservations", id), { status: "cancelled" });
    fetchReservations();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "courts"), { ...form, price: Number(form.price), available: true, ownerId: user.uid });
    setForm({ name: "", sport: "futbol", price: "", location: "" });
    setShowForm(false);
    fetchMyCourts();
  };

  const getCourtName = (courtId) => courts.find((c) => c.id === courtId)?.name || "Cancha";

  const sportEmoji = (sport) => ({ futbol: "⚽", padel: "🎾", tenis: "🎾", basquet: "🏀" }[sport] || "🏅");

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>;

  const tabs = [
    { id: "canchas", label: "Mis canchas" },
    { id: "pendientes", label: `Pendientes${pendingReservations.length > 0 ? ` (${pendingReservations.length})` : ""}` },
    { id: "confirmadas", label: "Confirmadas" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏟️</span>
            <span className="font-bold text-gray-900 text-lg">Reservá Tu Cancha</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/")} className="text-sm text-gray-600 hover:text-green-600 font-medium px-3 py-2 rounded-lg hover:bg-green-50 transition-colors">
              Ver canchas
            </button>
            <button onClick={() => { signOut(auth); navigate("/login"); }} className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg transition-colors">
              Salir
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mi panel</h1>
          {activeTab === "canchas" && (
            <button onClick={() => setShowForm(!showForm)} className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              {showForm ? "Cancelar" : "+ Agregar cancha"}
            </button>
          )}
        </div>

        {/* Form */}
        {showForm && activeTab === "canchas" && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Nueva cancha</h2>
            <input placeholder="Nombre de la cancha" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            <select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
              <option value="futbol">⚽ Fútbol</option>
              <option value="padel">🎾 Pádel</option>
              <option value="tenis">🎾 Tenis</option>
              <option value="basquet">🏀 Básquet</option>
            </select>
            <input placeholder="Precio por hora" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            <input placeholder="Ubicación" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            <button type="submit" className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition-colors">
              Guardar cancha
            </button>
          </form>
        )}

        {/* Tabs */}
        <div className="flex bg-white border border-gray-100 rounded-xl p-1 mb-6 shadow-sm">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? "bg-green-500 text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Canchas */}
        {activeTab === "canchas" && (
          courts.length === 0 ? (
            <div className="text-center py-20 text-gray-400">Todavía no tenés canchas cargadas.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {courts.map((court) => (
                <div key={court.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-br from-green-400 to-emerald-500 p-6 flex items-center justify-center">
                    <span className="text-4xl">{sportEmoji(court.sport)}</span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900">{court.name}</h3>
                    <p className="text-gray-500 text-sm mt-1">📍 {court.location}</p>
                    <p className="font-bold text-gray-900 mt-2">${court.price}<span className="text-gray-400 font-normal text-sm">/hora</span></p>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full mt-2 inline-block ${court.available ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                      {court.available ? "✅ Disponible" : "❌ No disponible"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Tab: Pendientes */}
        {activeTab === "pendientes" && (
          pendingReservations.length === 0 ? (
            <div className="text-center py-20 text-gray-400">No hay reservas pendientes.</div>
          ) : (
            <div className="space-y-4">
              {pendingReservations.map((res) => (
                <div key={res.id} className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900">{getCourtName(res.courtId)}</h3>
                      <p className="text-gray-500 text-sm mt-1">👤 {res.clientName}</p>
                      <p className="text-gray-500 text-sm">📅 {res.date} a las {res.startTime}hs</p>
                    </div>
                    <span className="text-xs font-semibold bg-amber-50 text-amber-600 px-2 py-1 rounded-full">Pendiente</span>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => handleConfirm(res.id)} className="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2 rounded-xl transition-colors">
                      ✅ Confirmar pago
                    </button>
                    <button onClick={() => handleReject(res.id)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-500 text-sm font-semibold py-2 rounded-xl transition-colors">
                      ❌ Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Tab: Confirmadas */}
        {activeTab === "confirmadas" && (
          confirmedReservations.length === 0 ? (
            <div className="text-center py-20 text-gray-400">No hay reservas confirmadas aún.</div>
          ) : (
            <div className="space-y-4">
              {confirmedReservations.map((res) => (
                <div key={res.id} className="bg-white rounded-2xl border border-green-100 shadow-sm p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900">{getCourtName(res.courtId)}</h3>
                      <p className="text-gray-500 text-sm mt-1">👤 {res.clientName}</p>
                      <p className="text-gray-500 text-sm">📅 {res.date} a las {res.startTime}hs</p>
                    </div>
                    <span className="text-xs font-semibold bg-green-50 text-green-600 px-2 py-1 rounded-full">Confirmada</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default OwnerPanel;