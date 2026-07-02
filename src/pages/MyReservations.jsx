// useEffect para montar el listener de tiempo real, useState para manejar reservas, canchas y carga
import { useEffect, useState } from "react";
import { useAsyncAction } from "../hooks/useAsyncAction";
// onSnapshot reemplaza a getDocs para las reservas del cliente, getDocs se mantiene solo para canchas 
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

function MyReservations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { run: runCancel, loading: cancelling } = useAsyncAction();
  // lista de reservas del cliente ordenadas por fecha de creacion descendente
  const [reservations, setReservations] = useState([]);
  // mapa { courtId -> datos de la cancha } para acceso rapido sin re-consultar Firestore por cada reserva
  const [courts, setCourts] = useState({});
  const [loading, setLoading] = useState(true);

  // Listener en tiempo real de las reservas del cliente, se dispara cada vez que hay un cambio en Firestore cracionm, elimiancion etc
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "reservations"), where("clientId", "==", user.uid));

    const unsub = onSnapshot(q, async (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // deduplicamos los courtIds para no consultar la misma cancha mas de una vez
      const courtIds = [...new Set(data.map((r) => r.courtId))];
      const courtData = {};
      // "__name__" filtra por ID de documento sin necesitar getDoc individual por cada cancha
      for (const courtId of courtIds) {
        const courtSnap = await getDocs(query(collection(db, "courts"), where("__name__", "==", courtId)));
        courtSnap.docs.forEach((d) => { courtData[d.id] = d.data(); });
      }

      // ordenamos por fecha de creacion descendente para mostrar las mas recientes primero
      const sortedReservations = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setReservations(sortedReservations);
      setCourts(courtData);
      setLoading(false);
    });

    // cancelamos el listener al desmontar para evitar fugas de memoria
    return () => unsub();
  }, [user]);

  const handleCancel = (res) => {
    runCancel(async () => {
      await updateDoc(doc(db, "reservations", res.id), { status: "cancelled" });
      await updateDoc(doc(db, "slots", `${res.courtId}_${res.date}_${res.startTime}`), { status: "cancelled" });
    });
  };

  // devuelve estilos y etiqueta segun el estado de la reserva para el badge de color
  const statusConfig = (status) => {
    if (status === "pending") return { label: "Pendiente de pago", bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" };
    if (status === "confirmed") return { label: "Confirmada", bg: "bg-green-50", text: "text-green-600", border: "border-green-100" };
    if (status === "cancelled") return { label: "Cancelada", bg: "bg-red-50", text: "text-red-500", border: "border-red-100" };
    // fallback por si llega un estado desconocido desde Firestore
    return { label: status, bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-100" };
  };

  // pantalla de carga inicial — desaparece en cuanto onSnapshot dispara el primer callback
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando tus reservas...</div>;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar con boton de volver al inicio */}
      <Navbar backTo="/" backLabel="Inicio" />

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header de la pagina */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mis reservas</h1>
          <p className="text-gray-500 mt-1">Historial de todas tus reservas</p>
        </div>

        {/* Estado vacio: el usuario aun no tiene reservas */}
        {reservations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            {/*<span className="text-5xl">📋</span>*/}
            <p className="text-gray-400 mt-4">Todavía no hiciste ninguna reserva.</p>
            <button onClick={() => navigate("/")} className="mt-4 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-6 py-2 rounded-xl transition-colors">
              Ver canchas
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {reservations.map((res) => {
              // resolvemos los datos de la cancha desde el mapa local para no re-consultar Firestore
              const court = courts[res.courtId];
              const status = statusConfig(res.status);
              return (
                <div key={res.id} className={`bg-white rounded-2xl border ${status.border} shadow-sm p-5`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{court ? court.name : "Cancha"}</h3>
                      <p className="text-gray-500 text-sm mt-1">{court ? court.location : ""}</p>
                      <p className="text-gray-500 text-sm">{res.date} a las {res.startTime}hs</p>
                      <p className="text-gray-500 text-sm">${court ? court.price : ""}/hora</p>
                    </div>
                    {/* Badge de estado con color dinamico segun statusConfig */}
                    <span className={`text-xs font-semibold ${status.bg} ${status.text} px-3 py-1 rounded-full whitespace-nowrap ml-3`}>
                      {status.label}
                    </span>
                  </div>
                  {/* Boton de cancelar solo visible si la reserva todavia esta pendiente */}
                  {res.status === "pending" && (
                    <button
                      onClick={() => handleCancel(res)}
                      disabled={cancelling}
                      className="mt-4 w-full bg-red-50 hover:bg-red-100 text-red-500 text-sm font-semibold py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancelling ? "Cancelando..." : "Cancelar reserva"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MyReservations;
