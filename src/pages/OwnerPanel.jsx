// useState para todos los estados del panel, useEffect para montar los listeners de tiempo real
import { useState, useEffect } from "react";
// onSnapshot reemplaza a getDocs para canchas y reservas — ya no se necesita getDocs
import { collection, addDoc, query, where, doc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
// Hook que protege acciones async contra doble-submit usando un ref de bloqueo sincronico
import { useAsyncAction } from "../hooks/useAsyncAction";

function OwnerPanel() {
  const { user } = useAuth();
  // una instancia de useAsyncAction por cada accion critica para que sus loadings sean independientes
  const { run: runAddCourt,    loading: addingCourt    } = useAsyncAction();
  const { run: runSaveEdit,    loading: savingEdit     } = useAsyncAction();
  const { run: runDeleteCourt, loading: deletingCourt  } = useAsyncAction();
  const { run: runConfirm,     loading: confirmingRes  } = useAsyncAction();
  const { run: runReject,      loading: rejectingRes   } = useAsyncAction();

  // canchas del dueno logueado — actualizadas en tiempo real por onSnapshot
  const [courts, setCourts] = useState([]);

  // reservas pendientes del dia de hoy — actualizadas en tiempo real por onSnapshot
  const [_pendingReservations, setPendingReservations] = useState([]);

  // reservas confirmadas del dia de hoy — actualizadas en tiempo real por onSnapshot
  const [_confirmedReservations, setConfirmedReservations] = useState([]);

  // reservas activas de la cancha seleccionada en el modal — listener propio que se activa con selectedCourt
  const [courtReservations, setCourtReservations] = useState([]);

  // fecha seleccionada en el modal de horarios, inicializada en hoy
  const today = new Date().toISOString().split("T")[0];
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(today);

  const [loading, setLoading] = useState(true);

  // controla visibilidad del formulario de nueva cancha
  const [showForm, setShowForm] = useState(false);

  // cancha seleccionada para el modal de horarios — cambiar este valor activa/cancela el listener de courtReservations
  const [selectedCourt, setSelectedCourt] = useState(null);

  // controla visibilidad del modal de horarios
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // controla visibilidad del modal de detalle de reserva
  const [showReservationModal, setShowReservationModal] = useState(false);

  // reserva seleccionada al hacer click en un horario del calendario
  const [selectedReservation, setSelectedReservation] = useState(null);

  // controla visibilidad del modal de edicion de cancha
  const [showEditModal, setShowEditModal] = useState(false);

  // cancha siendo editada actualmente
  const [courtToEdit, setCourtToEdit] = useState(null);

  // valores del formulario de edicion — se cargan al seleccionar una cancha del select
  const [editForm, setEditForm] = useState({ name: "", sport: "futbol", price: "", location: "" });

  // errores de validacion del formulario de edicion por campo
  const [editErrors, setEditErrors] = useState({});

  // valores del formulario de nueva cancha
  const [form, setForm] = useState({ name: "", sport: "futbol", price: "", location: "" });

  // Listener en tiempo real de las canchas del dueno.
  // Cualquier alta, edicion o baja se refleja automaticamente sin llamadas manuales post-mutacion.
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "courts"), where("ownerId", "==", user.uid));

    const unsub = onSnapshot(q, (snap) => {
      setCourts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      // apagamos el loading en el primer disparo del listener
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // Listener en tiempo real de las reservas pendientes de hoy.
  // Se separa en dos listeners (pending y confirmed) porque Firestore no permite
  // filtrar por dos valores distintos en el mismo campo con una sola query sin indice compuesto.
  useEffect(() => {
    if (!user) return;

    const fecha = new Date().toISOString().split("T")[0];

    const qPending = query(
      collection(db, "reservations"),
      where("ownerId", "==", user.uid),
      where("status", "==", "pending"),
      where("date", "==", fecha)
    );

    const unsubPending = onSnapshot(qPending, (snap) => {
      setPendingReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const qConfirmed = query(
      collection(db, "reservations"),
      where("ownerId", "==", user.uid),
      where("status", "==", "confirmed"),
      where("date", "==", fecha)
    );

    const unsubConfirmed = onSnapshot(qConfirmed, (snap) => {
      setConfirmedReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // cancelamos ambos listeners al desmontar o cuando cambia el usuario
    return () => { unsubPending(); unsubConfirmed(); };
  }, [user]);

  // Listener en tiempo real de las reservas de la cancha seleccionada en el modal.
  // Se monta cuando selectedCourt cambia y se cancela cuando selectedCourt vuelve a null
  // (lo que ocurre al cerrar el modal). El filtro de fecha se hace client-side en getReservation()
  // para evitar indices compuestos en Firestore (combinar "in" con ">=" requeriria uno).
  useEffect(() => {
    if (!selectedCourt) return;

    const q = query(
      collection(db, "reservations"),
      where("courtId", "==", selectedCourt.id),
      where("status", "in", ["confirmed", "pending"])
    );

    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // filtramos desde hoy en adelante client-side para mostrar solo reservas futuras o del dia
      setCourtReservations(all.filter((r) => r.date >= today));
    });

    return () => unsub();
  }, [selectedCourt]);

  // Confirma una reserva en Firestore — onSnapshot actualiza el calendario y el panel automaticamente
  const handleConfirm = (id) => runConfirm(async () => {
    await updateDoc(doc(db, "reservations", id), { status: "confirmed" });
  });

  // Rechaza una reserva en Firestore — onSnapshot la elimina del calendario y del panel automaticamente
  const handleReject = (id) => runReject(async () => {
    await updateDoc(doc(db, "reservations", id), { status: "cancelled" });
  });

  // Agrega una nueva cancha en Firestore — onSnapshot actualiza el grid de canchas automaticamente
  const handleSubmit = (e) => {
    e.preventDefault();
    runAddCourt(async () => {
      await addDoc(collection(db, "courts"), { ...form, price: Number(form.price), available: true, ownerId: user.uid });
      setForm({ name: "", sport: "futbol", price: "", location: "" });
      setShowForm(false);
    });
  };

  // al seleccionar una cancha del select, carga sus datos actuales en el formulario de edicion
  const handleSelectCourtToEdit = (courtId) => {
    const court = courts.find((c) => c.id === courtId);
    if (!court) return;
    setCourtToEdit(court);
    setEditForm({ name: court.name, sport: court.sport, price: court.price, location: court.location });
    setEditErrors({});
  };

  // valida que ningun campo obligatorio del formulario de edicion este vacio antes de guardar
  const validateEditForm = () => {
    const errors = {};
    if (!editForm.name.trim()) errors.name = "El nombre no puede estar vacío";
    if (!editForm.price) errors.price = "El precio no puede estar vacío";
    if (!editForm.location.trim()) errors.location = "La ubicación no puede estar vacía";
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // guarda los cambios de la cancha en Firestore — onSnapshot actualiza el grid automaticamente
  const handleSaveEdit = () => {
    if (!validateEditForm()) return;
    runSaveEdit(async () => {
      await updateDoc(doc(db, "courts", courtToEdit.id), {
        name: editForm.name,
        sport: editForm.sport,
        price: Number(editForm.price),
        location: editForm.location,
      });
      setShowEditModal(false);
      setCourtToEdit(null);
    });
  };

  // elimina la cancha de Firestore, pide confirmacion previa para evitar borrados accidentales
  const handleDeleteCourt = () => {
    if (!window.confirm(`¿Estás seguro que querés eliminar "${courtToEdit.name}"? Esta acción no se puede deshacer.`)) return;
    runDeleteCourt(async () => {
      await deleteDoc(doc(db, "courts", courtToEdit.id));
      setShowEditModal(false);
      setCourtToEdit(null);
    });
  };

  // franja horaria disponible para reservas, de 9 a 23hs con bloques de 1 hora
  const HORARIOS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"];

  // utilidades para mostrar emoji y etiqueta legible segun el deporte de la cancha
  const sportEmoji = (sport) => ({ futbol: "⚽", padel: "🎾", tenis: "🎾", basquet: "🏀" }[sport] || "🏅");
  const sportLabel = (sport) => ({ futbol: "Fútbol", padel: "Pádel", tenis: "Tenis", basquet: "Básquet" }[sport] || sport);

  // busca si existe una reserva activa para el horario y fecha seleccionados en el calendario
  const getReservation = (horario) => {
    return courtReservations.find(r => r.startTime === horario && r.date === selectedScheduleDate) || null;
  };

  // abre el modal de horarios para una cancha y activa el listener de courtReservations via selectedCourt
  const handleCourtClick = (court) => {
    setSelectedCourt(court);
    setSelectedScheduleDate(today);
    setCourtReservations([]); // limpiamos el estado anterior mientras el nuevo listener carga
    setShowScheduleModal(true);
  };

  // pantalla de carga inicial — desaparece en cuanto el primer onSnapshot de canchas dispara
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-50">

      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header con acciones rapidas para agregar y editar canchas */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mi panel</h1>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowEditModal(true); setCourtToEdit(null); setEditErrors({}); }}
              className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              ✏️ Editar cancha
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              {showForm ? "Cancelar" : "+ Agregar cancha"}
            </button>
          </div>
        </div>

        {/* Formulario de nueva cancha — se muestra u oculta con el boton de arriba */}
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
            {/* el boton se deshabilita mientras addingCourt es true para evitar doble submit */}
            <button
              type="submit"
              disabled={addingCourt}
              className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {addingCourt ? "Guardando..." : "Guardar cancha"}
            </button>
          </form>
        )}

        {/* Grid de cards de canchas — se actualiza en tiempo real cuando cambia la coleccion */}
        {courts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">Todavía no tenés canchas cargadas.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courts.map((court) => (
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

        {/* Modal de edicion de cancha: permite seleccionar, editar y eliminar una cancha del dueno */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="font-bold text-gray-900 text-lg">Editar cancha</h2>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
              </div>
              <div className="p-6 space-y-4">
                {/* select para elegir cual cancha editar — al cambiar carga sus datos en el formulario */}
                <select
                  onChange={(e) => handleSelectCourtToEdit(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  defaultValue=""
                >
                  <option value="" disabled>-- Elegí una cancha --</option>
                  {courts.map((court) => (
                    <option key={court.id} value={court.id}>{court.name}</option>
                  ))}
                </select>
                {/* formulario de edicion — solo aparece cuando hay una cancha seleccionada */}
                {courtToEdit && (
                  <div className="space-y-4 pt-2">
                    <div>
                      <input
                        placeholder="Nombre de la cancha"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${editErrors.name ? "border-red-400" : "border-gray-200"}`}
                      />
                      {editErrors.name && <p className="text-red-500 text-xs mt-1">{editErrors.name}</p>}
                    </div>
                    <select
                      value={editForm.sport}
                      onChange={(e) => setEditForm({ ...editForm, sport: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option value="futbol">⚽ Fútbol</option>
                      <option value="padel">🎾 Pádel</option>
                      <option value="tenis">🎾 Tenis</option>
                      <option value="basquet">🏀 Básquet</option>
                    </select>
                    <div>
                      <input
                        placeholder="Precio por hora"
                        type="number"
                        value={editForm.price}
                        onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                        className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${editErrors.price ? "border-red-400" : "border-gray-200"}`}
                      />
                      {editErrors.price && <p className="text-red-500 text-xs mt-1">{editErrors.price}</p>}
                    </div>
                    <div>
                      <input
                        placeholder="Ubicación"
                        value={editForm.location}
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                        className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${editErrors.location ? "border-red-400" : "border-gray-200"}`}
                      />
                      {editErrors.location && <p className="text-red-500 text-xs mt-1">{editErrors.location}</p>}
                    </div>
                    {/* ambos botones se deshabilitan mutuamente para evitar acciones simultaneas */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleSaveEdit}
                        disabled={savingEdit || deletingCourt}
                        className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
                      >
                        {savingEdit ? "Guardando..." : "Guardar cambios"}
                      </button>
                      <button
                        onClick={handleDeleteCourt}
                        disabled={deletingCourt || savingEdit}
                        className="flex-1 bg-red-50 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed text-red-500 font-semibold py-3 rounded-xl transition-colors"
                      >
                        {deletingCourt ? "Eliminando..." : "🗑️ Eliminar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de horarios: muestra el calendario en tiempo real de la cancha seleccionada */}
        {showScheduleModal && selectedCourt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

              {/* Header del modal con nombre y ubicacion de la cancha */}
              <div className="bg-gradient-to-br from-green-400 to-emerald-500 p-6 rounded-t-2xl flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-white text-xl">{selectedCourt.name}</h2>
                  <p className="text-green-100 text-sm">📍 {selectedCourt.location}</p>
                </div>
                {/* al cerrar el modal reseteamos selectedCourt para cancelar el listener de courtReservations */}
                <button
                  onClick={() => { setShowScheduleModal(false); setSelectedCourt(null); }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">

                {/* Selector de fecha — solo permite fechas desde hoy en adelante */}
                <div className="mb-5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">
                    📅 Selecciona una fecha
                  </label>
                  <input
                    type="date"
                    value={selectedScheduleDate}
                    min={today}
                    onChange={(e) => setSelectedScheduleDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>

                {/* Leyenda de colores para interpretar el estado de cada horario */}
                <div className="flex items-center gap-4 mb-4 text-xs font-semibold">
                  <span className="bg-green-100 text-green-600 px-2 py-1 rounded-full">🟢 Libre</span>
                  <span className="bg-amber-100 text-amber-600 px-2 py-1 rounded-full">🟡 Pendiente</span>
                  <span className="bg-red-100 text-red-600 px-2 py-1 rounded-full">🔴 Confirmado</span>
                </div>

                {/* Grilla de horarios — el color de cada bloque refleja el estado en tiempo real */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {HORARIOS.map((hora) => {
                    const res = getReservation(hora);
                    const status = res ? res.status : null;
                    return (
                      // click en horario ocupado abre el modal de detalle; en libre no hace nada
                      <button
                        key={hora}
                        className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                          status === "confirmed" ? "bg-red-100 text-red-600"
                          : status === "pending"   ? "bg-amber-100 text-amber-600"
                          : "bg-green-100 text-green-600"
                        }`}
                        onClick={() => { setSelectedReservation(res); setShowReservationModal(true); }}
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

        {/* Modal de detalle de reserva: muestra info del cliente y permite confirmar o rechazar */}
        {showReservationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h2 className="font-bold text-gray-900 text-lg mb-4">
                {/* si no hay reserva en el horario clickeado, muestra mensaje de horario libre */}
                {selectedReservation ? "Detalle de reserva" : "Horario libre"}
              </h2>
              {selectedReservation ? (
                <div className="space-y-2">
                  <p className="text-gray-600">👤 <strong>{selectedReservation.clientName}</strong></p>
                  <p className="text-gray-600">📅 {selectedReservation.date} a las {selectedReservation.startTime}hs</p>
                  <p className="text-gray-600">Estado: <strong>{selectedReservation.status === "confirmed" ? "✅ Confirmada" : "⏳ Pendiente"}</strong></p>
                  {/* botones de accion solo visibles si la reserva todavia esta pendiente */}
                  {selectedReservation.status === "pending" && (
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => { handleConfirm(selectedReservation.id); setShowReservationModal(false); }}
                        disabled={confirmingRes || rejectingRes}
                        className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 rounded-xl transition-colors"
                      >
                        {confirmingRes ? "Confirmando..." : "✅ Confirmar pago"}
                      </button>
                      <button
                        onClick={() => { handleReject(selectedReservation.id); setShowReservationModal(false); }}
                        disabled={rejectingRes || confirmingRes}
                        className="flex-1 bg-red-50 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed text-red-500 text-sm font-semibold py-2 rounded-xl transition-colors"
                      >
                        {rejectingRes ? "Rechazando..." : "❌ Rechazar"}
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
