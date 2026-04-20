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
    setReservedSlots(snapshot.docs.map((doc) => doc.data().startTime));
  };

  const handleDateChange = (e) => {
    setDate(e.target.value);
    setSuccess(false);
    fetchReservedSlots(e.target.value);
  };

  const handleReserve = async (startTime) => {
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

    const ownerRef = doc(db, "users", court.ownerId);
    const ownerSnap = await getDoc(ownerRef);
    const ownerData = ownerSnap.data();
    const mensaje = `Hola! Quiero reservar *${court.name}* para el *${date}* a las *${startTime}hs*. Mi nombre es ${user.displayName || user.email}. Quedo esperando el alias para confirmar el pago. ¡Gracias!`;
    const url = `https://api.whatsapp.com/send?phone=${ownerData.whatsapp}&text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");

    setSuccess(true);
    fetchReservedSlots(date);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>;
  if (!court) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cancha no encontrada.</div>;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-gray-600 hover:text-green-600 font-medium transition-colors">
            ← Volver
          </button>
          <span className="font-bold text-gray-900">Reservá Tu Cancha ⚽</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Info cancha */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-br from-green-400 to-emerald-500 p-8 flex items-center justify-center">
            <span className="text-6xl">⚽</span>
          </div>
          <div className="p-5">
            <h1 className="text-2xl font-bold text-gray-900">{court.name}</h1>
            <p className="text-gray-500 mt-1">📍 {court.location}</p>
            <p className="text-green-600 font-bold text-lg mt-2">${court.price}<span className="text-gray-400 font-normal text-sm">/hora</span></p>
          </div>
        </div>

        {/* Selector de fecha */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Elegí una fecha</h2>
          <input
            type="date"
            value={date}
            onChange={handleDateChange}
            min={new Date().toISOString().split("T")[0]}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        {/* Mensaje de éxito */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-2xl px-5 py-4 mb-6 text-sm">
            ✅ <strong>¡Solicitud enviada!</strong> El dueño te va a confirmar por WhatsApp una vez que reciba el pago.
          </div>
        )}

        {/* Horarios */}
        {date && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Horarios disponibles</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {HORARIOS.map((hora) => {
                const isReserved = reservedSlots.includes(hora);
                return (
                  <button
                    key={hora}
                    onClick={() => !isReserved && handleReserve(hora)}
                    disabled={isReserved}
                    className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                      isReserved
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-green-500 hover:bg-green-600 text-white shadow-sm hover:shadow-md"
                    }`}
                  >
                    {hora}
                    {isReserved && <span className="block text-xs font-normal">Ocupado</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Reserve;