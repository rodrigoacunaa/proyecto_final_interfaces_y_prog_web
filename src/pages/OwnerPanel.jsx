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

  //reservas pendientes del día
  const [pendingReservations, setPendingReservations] = useState([]);

  //reservas confirmadas del día
  const [confirmedReservations, setConfirmedReservations] = useState([]);

  const [loading, setLoading] = useState(true);

  //se muestra el form de nueva cancha?
  const [showForm, setShowForm] = useState(false);

  //qué cancha está seleccionada para ver sus horarios
  const [selectedCourt, setSelectedCourt] = useState(null);

  //controla si el modal de horarios está abierto
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  //controla si el modal de detalle de reserva está abierto
  const [showReservationModal, setShowReservationModal] = useState(false);

  //reserva seleccionada al clickear un horario
  const [selectedReservation, setSelectedReservation] = useState(null);

  //valores del form "nueva cancha"
  const [form, setForm] = useState({ name: "", sport: "futbol", price: "", location: "" });

  const fetchMyCourts = async () => {
    //solo se muestran las canchas que coinciden con el id del dueño
    const q = query(collection(db, "courts"), where("ownerId", "==", user.uid));
    const snapshot = await getDocs(q);
    setCourts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  const fetchReservations = async () => {
    //traemos la fecha de hoy en formato YYYY-MM-DD
    let fecha = new Date().toISOString().split("T")[0];
    const [pendingSnap, confirmedSnap] = await Promise.all([
      //solo reservas pendientes del día
      getDocs(query(collection(db, "reservations"), where("ownerId", "==", user.uid), where("status", "==", "pending"), where("date", "==", fecha))),
      //solo reservas confirmadas del día
      getDocs(query(collection(db, "reservations"), where("ownerId", "==", user.uid), where("status", "==", "confirmed"), where("date", "==", fecha))),
    ]);
    setPendingReservations(pendingSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    setConfirmedReservations(confirmedSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  };

  useEffect(() => { fetchMyCourts(); fetchReservations(); }, []);

  const handleConfirm = async (id) => {
    await updateDoc(doc(db, "reservations", id), { status: "confirmed" });
    //recargamos las reservas para reflejar el cambio en la grilla
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

  //horarios disponibles de 9am a medianoche
  const HORARIOS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"];

  const sportEmoji = (sport) => ({ futbol: "⚽", padel: "🎾", tenis: "🎾", basquet: "🏀" }[sport] || "🏅");
  const sportLabel = (sport) => ({ futbol: "Fútbol", padel: "Pádel", tenis: "Tenis", basquet: "Básquet" }[sport] || sport);

  //dado un horario, busca si existe una reserva (confirmada o pendiente) para la cancha seleccionada hoy
  const getReservation = (horario) => {
    let fecha = new Date().toISOString().split("T")[0];

    const res = confirmedReservations.find(reserva =>
      reserva.courtId === selectedCourt?.id &&
      reserva.startTime === horario &&
      reserva.date === fecha
    );

    const pending_res = pendingReservations.find(reserva =>
      reserva.courtId === selectedCourt?.id &&
      reserva.startTime === horario &&
      reserva.date === fecha
    );

    if (res != null) return res;
    else if (pending_res != null) return pending_res;
    else return null;
  };

  //abre el modal de horarios con la cancha seleccionada
  const handleCourtClick = (court) => {
    setSelectedCourt(court);
    setShowScheduleModal(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>;

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
          <button onClick={() => setShowForm(!showForm)} className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            {showForm ? "Cancelar" : "+ Agregar cancha"}
          </button>
        </div>

        {/* Form nueva cancha */}
        {showForm && (
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

        {/* Cards de canchas — reemplaza el <select> anterior */}
        {courts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">Todavía no tenés canchas cargadas.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courts.map((court) => (
              //al clickear la card se abre el modal de horarios con esa cancha
              <button
                key={court.id}
                onClick={() => handleCourtClick(court)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-green-200 transition-all text-left"
              >
                <div className="bg-gradient-to-br from-green-400 to-emerald-500 p-6 flex items-center justify-center">
                  <span className="text-4xl">{sportEmoji(court.sport)}</span>
                </div>
                <div className="p-4">
                  <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    {sportLabel(court.sport)}
                  </span>
                  <h3 className="font-bold text-gray-900 mt-2">{court.name}</h3>
                  <p className="text-gray-500 text-sm mt-1">📍 {court.location}</p>
                  <p className="font-bold text-gray-900 mt-2">${court.price}<span className="text-gray-400 font-normal text-sm">/hora</span></p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Modal de horarios — se abre al clickear una cancha */}
        {showScheduleModal && selectedCourt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

              {/* Header del modal */}
              <div className="bg-gradient-to-br from-green-400 to-emerald-500 p-6 rounded-t-2xl flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-white text-xl">{selectedCourt.name}</h2>
                  <p className="text-green-100 text-sm">📍 {selectedCourt.location}</p>
                </div>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Grilla de horarios */}
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4 text-xs font-semibold">
                  <span className="bg-green-100 text-green-600 px-2 py-1 rounded-full">🟢 Libre</span>
                  <span className="bg-amber-100 text-amber-600 px-2 py-1 rounded-full">🟡 Pendiente</span>
                  <span className="bg-red-100 text-red-600 px-2 py-1 rounded-full">🔴 Confirmado</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {HORARIOS.map((hora) => {
                    const res = getReservation(hora);
                    //derivamos el status del objeto reserva
                    const status = res != null ? res.status : null;
                    return (
                      <button
                        key={hora}
                        className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                          status === "confirmed" ? "bg-red-100 text-red-600"
                          : status === "pending" ? "bg-amber-100 text-amber-600"
                          : "bg-green-100 text-green-600"
                        }`}
                        //al clickear un horario se abre el modal de detalle de reserva
                        onClick={() => {
                          setSelectedReservation(res);
                          setShowReservationModal(true);
                        }}
                      >
                        {hora}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de detalle de reserva — se abre al clickear un horario */}
        {showReservationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">

              <h2 className="font-bold text-gray-900 text-lg mb-4">
                {selectedReservation ? "Detalle de reserva" : "Horario libre"}
              </h2>

              {selectedReservation ? (
                <div className="space-y-2">
                  <p className="text-gray-600">👤 <strong>{selectedReservation.clientName}</strong></p>
                  <p className="text-gray-600">📅 {selectedReservation.date} a las {selectedReservation.startTime}hs</p>
                  <p className="text-gray-600">Estado: <strong>{selectedReservation.status === "confirmed" ? "✅ Confirmada" : "⏳ Pendiente"}</strong></p>

                  {/* botones de confirmar/rechazar solo para reservas pendientes */}
                  {selectedReservation.status === "pending" && (
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => { handleConfirm(selectedReservation.id); setShowReservationModal(false); }}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
                      >
                        ✅ Confirmar pago
                      </button>
                      <button
                        onClick={() => { handleReject(selectedReservation.id); setShowReservationModal(false); }}
                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-500 text-sm font-semibold py-2 rounded-xl transition-colors"
                      >
                        ❌ Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400">Este horario está disponible.</p>
              )}

              <button
                onClick={() => setShowReservationModal(false)}
                className="mt-6 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold py-2 rounded-xl transition-colors"
              >
                Cerrar
              </button>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default OwnerPanel;