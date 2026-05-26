// useEffect para disparar el fetch al montar, useState para manejar reservas, canchas y estado de carga
import { useEffect, useState } from "react";
// Funciones de Firestore para consultar reservas del cliente y actualizar el estado de una reserva
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

function MyReservations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // reservations: lista de reservas del cliente ordenadas por fecha de creacion
  const [reservations, setReservations] = useState([]);
  // courts: mapa { courtId -> datos de la cancha } para acceso rapido desde cada reserva sin refetch
  const [courts, setCourts] = useState({});
  const [loading, setLoading] = useState(true);

  // Patron SWR: primero muestra datos de cache local (respuesta inmediata),
  // luego consulta Firebase en segundo plano y actualiza solo si hay cambios
  const fetchReservations = async () => {
    // Intentamos levantar las reservas y sus canchas de la cache de sesion
    const cachedData = sessionStorage.getItem("myReservationsCache");

    if(cachedData){
      const {reservations: cachedRes, courts: cachedCourts } = JSON.parse(cachedData);
      setReservations(cachedRes);
      setCourts(cachedCourts);
      setLoading(false); // apagamos el loading porque ya tenemos datos visibles al instante
    }

    try{
      // Traemos los datos frescos de Firebase filtrando solo las reservas del usuario actual
      const q = query(collection(db, "reservations"),where("clientId", "==", user.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Deduplicamos los courtIds para no hacer multiples consultas a la misma cancha
      const courtIds = [...new Set(data.map((r) => r.courtId))];
      const courtData = {};
      // Usamos "__name__" para filtrar por ID de documento sin necesitar getDoc individual por cada cancha
      for (const courtId of courtIds) {
        const courtSnap = await getDocs(query(collection(db, "courts"), where("__name__", "==", courtId)));
        courtSnap.docs.forEach((d) => { courtData[d.id] = d.data(); });
    }

    // Ordenamos por fecha de creacion descendente para mostrar las mas recientes primero
    const sortedReservations = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const freshCachePayload = { reservations: sortedReservations, courts: courtData };

    // Comparamos con la cache antes de actualizar el estado para evitar renders innecesarios
    if (JSON.stringify(freshCachePayload) !== cachedData) {
        setReservations(sortedReservations);
        setCourts(courtData);
        // Guardamos la nueva foto de los datos en cache para la proxima visita
        sessionStorage.setItem("myReservationsCache", JSON.stringify(freshCachePayload));
      }

    } catch(error){
      console.error("Error al traer las reservas de Firebase: ",error);
    } finally {
      setLoading(false); // por si es la primera vez que entra y no habia cache previa
    }

  };

  // Se ejecuta una sola vez al montar el componente para cargar las reservas del usuario
  useEffect(() => { fetchReservations(); }, []);

  // Cancela una reserva actualizando su estado en Firestore y refresca la lista para reflejar el cambio
  const handleCancel = async (reservationId) => {
    await updateDoc(doc(db, "reservations", reservationId), { status: "cancelled" });
    fetchReservations();
  };

  // Devuelve estilos y etiqueta segun el estado de la reserva para mostrar el badge de color correcto
  const statusConfig = (status) => {
    if (status === "pending") return { label: "Pendiente de pago", bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" };
    if (status === "confirmed") return { label: "Confirmada", bg: "bg-green-50", text: "text-green-600", border: "border-green-100" };
    if (status === "cancelled") return { label: "Cancelada", bg: "bg-red-50", text: "text-red-500", border: "border-red-100" };
    // Fallback por si llega un estado desconocido desde Firestore
    return { label: status, bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-100" };
  };

  // Pantalla de carga inicial — solo se muestra si no habia datos en cache al montar
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
            <span className="text-5xl">📋</span>
            <p className="text-gray-400 mt-4">Todavía no hiciste ninguna reserva.</p>
            <button onClick={() => navigate("/")} className="mt-4 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-6 py-2 rounded-xl transition-colors">
              Ver canchas
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {reservations.map((res) => {
              // Resolvemos los datos de la cancha desde el mapa local para no re-consultar Firestore
              const court = courts[res.courtId];
              const status = statusConfig(res.status);
              return (
                <div key={res.id} className={`bg-white rounded-2xl border ${status.border} shadow-sm p-5`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{court ? court.name : "Cancha"}</h3>
                      <p className="text-gray-500 text-sm mt-1">📍 {court ? court.location : ""}</p>
                      <p className="text-gray-500 text-sm">📅 {res.date} a las {res.startTime}hs</p>
                      <p className="text-gray-500 text-sm">💰 ${court ? court.price : ""}/hora</p>
                    </div>
                    {/* Badge de estado con color dinamico segun statusConfig */}
                    <span className={`text-xs font-semibold ${status.bg} ${status.text} px-3 py-1 rounded-full whitespace-nowrap ml-3`}>
                      {status.label}
                    </span>
                  </div>
                  {/* Solo mostramos el boton de cancelar si la reserva todavia esta pendiente */}
                  {res.status === "pending" && (
                    <button
                      onClick={() => handleCancel(res.id)}
                      className="mt-4 w-full bg-red-50 hover:bg-red-100 text-red-500 text-sm font-semibold py-2 rounded-xl transition-colors"
                    >
                      Cancelar reserva
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
