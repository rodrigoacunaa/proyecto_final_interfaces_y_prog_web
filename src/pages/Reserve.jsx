// useEffect para cargar la cancha al montar y el listener de horarios, useState para fecha y estado del flujo
import { useEffect, useState } from "react";
// useParams para leer el courtId de la URL, useNavigate para redirigir si el dueno intenta reservar su propia cancha
import { useParams, useNavigate } from "react-router-dom";
// getDoc para traer un documento por ID, addDoc para crear la reserva, onSnapshot para horarios en tiempo real
import { doc, getDoc, collection, addDoc, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
// Hook para proteger el submit de la reserva contra doble-click, expone tambien loading y error
import { useAsyncAction } from "../hooks/useAsyncAction";

// Franja horaria disponible para reservas, de 9 a 20hs con bloques de 1 hora
const HORARIOS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

function Reserve() {
  // run: ejecuta la accion de reservar con proteccion anti-doble-submit
  // isSubmitting: bloquea todos los horarios mientras se procesa una reserva
  // reserveError: mensaje de error si falla el addDoc
  const { run: runReserve, loading: isSubmitting, error: reserveError } = useAsyncAction();
  // courtId viene de la URL: /reserve/:courtId
  const { courtId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  // datos de la cancha cargados desde Firestore
  const [court, setCourt] = useState(null);
  // fecha seleccionada por el usuario en formato YYYY-MM-DD
  const [date, setDate] = useState("");
  // mapa { hora -> status } de los horarios ocupados para la fecha seleccionada
  const [reservedSlots, setReservedSlots] = useState({});
  // numero de whatsapp del dueno, pre-cargado al montar para poder abrir el chat de forma sincronica
  const [ownerWhatsapp, setOwnerWhatsapp] = useState(null);
  const [loading, setLoading] = useState(true);
  // flag que muestra el mensaje de exito tras crear la reserva correctamente
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchCourt = async () => {
      const docRef = doc(db, "courts", courtId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        // el dueno no puede reservar su propia cancha, lo redirigimos al home
        if (data.ownerId === user.uid) { navigate("/"); return; }
        // Pre-cargamos el whatsapp del dueno aqui por dos razones:
        // 1. el guard ownerSnap.exists() evita un crash por null-deref
        // 2. guardar el numero en estado permite abrir window.open de forma sincronica
        //    en handleReserve (antes de cualquier await), evitando que los bloqueadores de popups lo bloqueen
        const ownerSnap = await getDoc(doc(db, "users", data.ownerId));
        setOwnerWhatsapp(ownerSnap.exists() ? ownerSnap.data().whatsapp || null : null);
        setCourt({ id: docSnap.id, ...data });
      }
      setLoading(false);
    };
    fetchCourt();
  }, [courtId]);

  // Listener en tiempo real de horarios ocupados para la fecha seleccionada.
  // Se suscribe cada vez que cambia la fecha y se limpia al cambiar o desmontar,
  // de modo que cualquier reserva nueva de otro cliente aparece sin recargar.
  useEffect(() => {
    if (!date) return;
    const q = query(
      collection(db, "reservations"),
      where("courtId", "==", courtId),
      where("date", "==", date),
      where("status", "in", ["confirmed", "pending"])
    );
    const unsub = onSnapshot(q, (snap) => {
      const slotsData = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        slotsData[data.startTime] = data.status;
      });
      setReservedSlots(slotsData);
    });
    return () => unsub();
  }, [courtId, date]);

  // Al cambiar la fecha solo limpiamos el exito anterior; el useEffect de onSnapshot se encarga de los horarios
  const handleDateChange = (e) => {
    setDate(e.target.value);
    setSuccess(false);
  };

  const handleReserve = (startTime) => {
    // Armamos el mensaje pre-completado para el dueno con los datos de la reserva
    const mensaje = `Hola! Quiero reservar *${court.name}* para el *${date}* a las *${startTime}hs*. Mi nombre es ${user.displayName || user.email}. Quedo esperando el alias para confirmar el pago. ¡Gracias!`;
    const url = `https://api.whatsapp.com/send?phone=${ownerWhatsapp}&text=${encodeURIComponent(mensaje)}`;
    // window.open debe llamarse ANTES de cualquier await para mantenerse en el contexto
    // de gesto del usuario — si se llama despues de un await los bloqueadores de popups lo cancelan
    window.open(url, "_blank");

    runReserve(async () => {
      await addDoc(collection(db, "reservations"), {
        courtId,
        clientId: user.uid,
        clientName: user.displayName || user.email,
        ownerId: court.ownerId,
        date,
        startTime,
        // endTime es el siguiente horario del array; si es el ultimo se usa "21:00" como cierre
        endTime: HORARIOS[HORARIOS.indexOf(startTime) + 1] || "21:00",
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      setSuccess(true);
      // onSnapshot detecta el nuevo doc y actualiza los horarios automaticamente
    });
  };

  // Pantalla de carga mientras se obtienen los datos de la cancha desde Firestore
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>;
  // Si el courtId no existe en Firestore mostramos error en lugar de romper el render
  if (!court) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cancha no encontrada.</div>;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar con boton de volver al listado de canchas */}
      <Navbar backTo="/" backLabel="Canchas" />

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Card con la info de la cancha: nombre, ubicacion y precio */}
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

        {/* Selector de fecha — solo permite fechas desde hoy en adelante */}
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

        {/* Mensaje de exito tras crear la reserva — le indica al usuario que espere confirmacion por WhatsApp */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-2xl px-5 py-4 mb-6 text-sm">
            ✅ <strong>¡Solicitud enviada!</strong> El dueño te va a confirmar por WhatsApp una vez que reciba el pago.
          </div>
        )}

        {/* Error de Firestore u otro error inesperado al intentar crear la reserva */}
        {reserveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4 mb-6 text-sm">
            ❌ {reserveError}
          </div>
        )}

        {/* Aviso si el dueno todavia no configuro su WhatsApp — bloquea la reserva hasta que lo haga */}
        {!ownerWhatsapp && !loading && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl px-5 py-4 mb-6 text-sm">
            ⚠️ El dueño aún no configuró su WhatsApp de contacto. No podés reservar hasta que lo haga.
          </div>
        )}

        {/* Grilla de horarios — solo se muestra si hay fecha seleccionada y el dueno tiene WhatsApp configurado */}
        {date && ownerWhatsapp && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Horarios disponibles</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {HORARIOS.map((hora) => {
                const status = reservedSlots[hora];
                const isReserved = status === "confirmed" || status === "pending";

                // Estilos dinamicos segun el estado del horario: libre, pendiente, confirmado o en proceso de submit
                let btnClass = "bg-green-500 hover:bg-green-600 text-white shadow-sm hover:shadow-md";
                if (status === "confirmed") {
                  btnClass = "bg-gray-100 text-gray-400 cursor-not-allowed";
                } else if (status === "pending") {
                  btnClass = "bg-amber-50 text-amber-600 border border-amber-200 cursor-not-allowed";
                } else if (isSubmitting) {
                  // bloquea todos los horarios libres mientras se procesa la reserva activa
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
