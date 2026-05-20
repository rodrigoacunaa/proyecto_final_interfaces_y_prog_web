import { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

function MyReservations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [courts, setCourts] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchReservations = async () => {
    //Intentamos levantar las reservar y sus canchas de la caché
    const cachedData = sessionStorage.getItem("myReservationsCache");

    if(cachedData){
      const {reservations: cachedRes, courts: cachedCourts } = JSON.parse(cachedData);
      setReservations(cachedRes);
      setCourts(cachedCourts);
      setLoading(false); // loading en off porque ya detectamos datos visibles
    }

    try{
      //Traemos los datos frescos de Firebase en segundo plano
      const q = query(collection(db, "reservations"),where("clientId", "==", user.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const courtIds = [...new Set(data.map((r) => r.courtId))];
      const courtData = {};
      for (const courtId of courtIds) {
        const courtSnap = await getDocs(query(collection(db, "courts"), where("__name__", "==", courtId)));
        courtSnap.docs.forEach((d) => { courtData[d.id] = d.data(); });
    }

    const sortedReservations = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const freshCachePayload = { reservations: sortedReservations, courts: courtData };

    //Comparamos con la caché, si algo cambió, actualizamos
    if (JSON.stringify(freshCachePayload) !== cachedData) {
        setReservations(sortedReservations);
        setCourts(courtData);
        // Guardamos la nueva foto de los datos en la caché
        sessionStorage.setItem("myReservationsCache", JSON.stringify(freshCachePayload));
      }
    
    } catch(error){
      console.error("Error al traer las reservas de Firebase: ",error);
    } finally {
      setLoading(false); // Por si es la primera vez que entra y no había caché previa
    }

  };

  useEffect(() => { fetchReservations(); }, []);

  const handleCancel = async (reservationId) => {
    await updateDoc(doc(db, "reservations", reservationId), { status: "cancelled" });
    fetchReservations();
  };

  const statusConfig = (status) => {
    if (status === "pending") return { label: "Pendiente de pago", bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" };
    if (status === "confirmed") return { label: "Confirmada", bg: "bg-green-50", text: "text-green-600", border: "border-green-100" };
    if (status === "cancelled") return { label: "Cancelada", bg: "bg-red-50", text: "text-red-500", border: "border-red-100" };
    return { label: status, bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-100" };
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando tus reservas...</div>;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚽</span>
            <span className="font-bold text-gray-900 text-lg">Reservá Tu Cancha</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/")} className="text-sm text-gray-600 hover:text-green-600 font-medium px-3 py-2 rounded-lg hover:bg-green-50 transition-colors">
              ← Volver
            </button>
            <button onClick={() => { signOut(auth); navigate("/login"); }} className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg transition-colors">
              Salir
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mis reservas</h1>
          <p className="text-gray-500 mt-1">Historial de todas tus reservas</p>
        </div>

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
                    <span className={`text-xs font-semibold ${status.bg} ${status.text} px-3 py-1 rounded-full whitespace-nowrap ml-3`}>
                      {status.label}
                    </span>
                  </div>
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