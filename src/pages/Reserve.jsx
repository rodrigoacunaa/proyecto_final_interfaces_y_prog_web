import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";


const HORARIOS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

function Reserve() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const { courtId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [court, setCourt] = useState(null);
  const [date, setDate] = useState("");
  const [reservedSlots, setReservedSlots] = useState({});
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
      where("status", "in", ["confirmed", "pending"])
    );
    const snapshot = await getDocs(q);
     //Armamos un objeto
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

const handleReserve = async (startTime) => {
    // Chequeamos la referencia síncrona
    if (isSubmittingRef.current) return; 
    
    // Bloqueamos de forma inmediata
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    
    try {
      // Guardamos la reserva en Firestore
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

      // Buscamos el teléfono del dueño
      const ownerRef = doc(db, "users", court.ownerId);
      const ownerSnap = await getDoc(ownerRef);
      const ownerData = ownerSnap.data();
      
      // Preparamos y abrimos WhatsApp
      const mensaje = `Hola! Quiero reservar *${court.name}* para el *${date}* a las *${startTime}hs*. Mi nombre es ${user.displayName || user.email}. Quedo esperando el alias para confirmar el pago. ¡Gracias!`;
      const url = `https://api.whatsapp.com/send?phone=${ownerData.whatsapp}&text=${encodeURIComponent(mensaje)}`;
      window.open(url, "_blank");

      // Actualizamos el mensaje de éxito y recargamos los horarios
      setSuccess(true);
      await fetchReservedSlots(date); 

    } catch (error) {
      // Mostramos el error por consola
      console.error("Hubo un error al procesar la reserva:", error);
    } finally {
      // Liberamos el bloqueo sólo cuando todo lo anterior terminó
      isSubmittingRef.current = false;
      setIsSubmitting(false); 
    }
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
                const status = reservedSlots[hora];
                const isReserved = status === "confirmed" || status === "pending";
                
                //Lógica para los colores del botón
                let btnClass = "bg-green-500 hover:bg-green-600 text-white shadow-sm hover:shadow-md" //El turno se encuentra libre por defecto

                if(status === "confirmed"){
                  btnClass = "bg-gray-100 text-gray-400 cursor-not-allowed";
                }else if(status === "pending"){
                  btnClass = "bg-amber-50 text-amber-600 border-amber-200 cursor-not-allowed";
                }else if(isSubmitting){
                  btnClass = "bg-gray-100 text-gray-400 cursor-not-allowed"; //bloqueamos los botones libres mientras se envía
                }

                return (
                  <button
                    key={hora}
                    onClick={() => !isReserved && !isSubmitting && handleReserve(hora)}
                    disabled={isReserved || isSubmitting}
                    className={`py-3 rounded-xl text-sm font-semibold transition-all ${btnClass}`}>

                    <span className="font-semibold block">{hora}</span>

                    {/*textos descriptivos debajo de la hora*/}
                    {status === "confirmed" && <span className="block text-xs font-normal mt-0.5">Ocupado</span>}
                    {status === "pending" && <span className="block text-xs font-normal mt-0.5">Pendiente de pago</span>}
                    {isSubmitting && !isReserved && <span className="block text-xs font normal mt-0.5">Enviando...</span>}
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