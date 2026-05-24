import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import { useAsyncAction } from "../hooks/useAsyncAction";

const HORARIOS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

function Reserve() {
  const { run: runReserve, loading: isSubmitting, error: reserveError } = useAsyncAction();
  const { courtId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [court, setCourt] = useState(null);
  const [date, setDate] = useState("");
  const [reservedSlots, setReservedSlots] = useState({});
  const [ownerWhatsapp, setOwnerWhatsapp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchCourt = async () => {
      const docRef = doc(db, "courts", courtId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.ownerId === user.uid) { navigate("/"); return; }
        // Pre-fetching owner data here fixes two issues:
        // 1. ownerSnap.exists() guard prevents null-deref crash
        // 2. Storing whatsapp in state lets window.open fire synchronously
        //    in handleReserve (before any await), bypassing popup blockers
        const ownerSnap = await getDoc(doc(db, "users", data.ownerId));
        setOwnerWhatsapp(ownerSnap.exists() ? ownerSnap.data().whatsapp || null : null);
        setCourt({ id: docSnap.id, ...data });
      }
      setLoading(false);
    };
    fetchCourt();
  }, [courtId]);

  const fetchReservedSlots = async (selectedDate) => {
    const q = query(
      collection(db, "reservations"),
      where("courtId", "==", courtId),
      where("date", "==", selectedDate),
      where("status", "in", ["confirmed", "pending"])
    );
    const snapshot = await getDocs(q);
    const slotsData = {};
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      slotsData[data.startTime] = data.status;
    });
    setReservedSlots(slotsData);
  };

  const handleDateChange = (e) => {
    setDate(e.target.value);
    setSuccess(false);
    fetchReservedSlots(e.target.value);
  };

  const handleReserve = (startTime) => {
    const mensaje = `Hola! Quiero reservar *${court.name}* para el *${date}* a las *${startTime}hs*. Mi nombre es ${user.displayName || user.email}. Quedo esperando el alias para confirmar el pago. ¡Gracias!`;
    const url = `https://api.whatsapp.com/send?phone=${ownerWhatsapp}&text=${encodeURIComponent(mensaje)}`;
    // window.open antes de cualquier await para mantener el contexto de gesto
    // del usuario — los bloqueadores de popups lo bloquean si se llama post-await
    window.open(url, "_blank");

    runReserve(async () => {
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
      setSuccess(true);
      await fetchReservedSlots(date);
    });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>;
  if (!court) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cancha no encontrada.</div>;

  return (
    <div className="min-h-screen bg-gray-50">

      <Navbar backTo="/" backLabel="Canchas" />

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

        {/* Error de Firestore u otro error inesperado */}
        {reserveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4 mb-6 text-sm">
            ❌ {reserveError}
          </div>
        )}

        {/* Aviso si el dueño no tiene WhatsApp configurado */}
        {!ownerWhatsapp && !loading && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl px-5 py-4 mb-6 text-sm">
            ⚠️ El dueño aún no configuró su WhatsApp de contacto. No podés reservar hasta que lo haga.
          </div>
        )}

        {/* Horarios */}
        {date && ownerWhatsapp && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Horarios disponibles</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {HORARIOS.map((hora) => {
                const status = reservedSlots[hora];
                const isReserved = status === "confirmed" || status === "pending";

                let btnClass = "bg-green-500 hover:bg-green-600 text-white shadow-sm hover:shadow-md";
                if (status === "confirmed") {
                  btnClass = "bg-gray-100 text-gray-400 cursor-not-allowed";
                } else if (status === "pending") {
                  btnClass = "bg-amber-50 text-amber-600 border border-amber-200 cursor-not-allowed";
                } else if (isSubmitting) {
                  btnClass = "bg-gray-100 text-gray-400 cursor-not-allowed";
                }

                return (
                  <button
                    key={hora}
                    onClick={() => !isReserved && !isSubmitting && handleReserve(hora)}
                    disabled={isReserved || isSubmitting}
                    className={`py-3 rounded-xl text-sm font-semibold transition-all ${btnClass}`}
                  >
                    <span className="font-semibold block">{hora}</span>
                    {status === "confirmed" && <span className="block text-xs font-normal mt-0.5">Ocupado</span>}
                    {status === "pending" && <span className="block text-xs font-normal mt-0.5">Pendiente de pago</span>}
                    {isSubmitting && !isReserved && <span className="block text-xs font-normal mt-0.5">Enviando...</span>}
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
