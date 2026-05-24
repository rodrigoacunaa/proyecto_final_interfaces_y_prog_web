import { useState, useRef, useEffect } from "react"; // useRef para detectar clicks afuera del menu, useEffect para cargar notificaciones al montar y limpiar event listener
import { signOut } from "firebase/auth"; // funciones de Firestore para actualizar estado de reservas y whatsapp, y para fetchear reservas pendientes con su cancha asociada
import { auth, db } from "../firebase/config";// useAuth para obtener info del usuario logueado y su rol, useNavigate para redirigir al logout y a otras paginas
import { doc, updateDoc, collection, getDocs, query, where } from "firebase/firestore"; // Componentes de UI: Avatar de usuario con fallback a inicial, campana de notificaciones con badge y dropdown, menu de perfil con opciones segun rol y edicion de WhatsApp in-place para duenos
import { useAuth } from "../context/AuthContext"; // useAuth para obtener info del usuario logueado y su rol, useNavigate para redirigir al logout y a otras paginas
import { useNavigate, useLocation } from "react-router-dom"; // useLocation para saber en que ruta estamos y ocultar el boton de navegacion si ya estas en esa pagina

function UserAvatar({ user, size = "md" }) { //en esta secion genramos un avatar circular para el usuario adaptando el tama;o segun la prop size,
//  y mostrando la inicial del nombre si no hay foto o si la foto falla al cargar (ej. por bloqueo de CORS)
  const [imgError, setImgError] = useState(false); //const estado para manejar error de carga de imagen (ej. bloqueo CORS) y mostrar inicial en su lugar no se puede reasignar.

  const sizeClasses = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-12 h-12 text-base",
  };

  const initial = (user?.name || user?.displayName || user?.email || "?")
    .charAt(0)
    .toUpperCase();

  if (user?.photoURL && !imgError) {
    return (
      <img
        src={user.photoURL}
        alt={user.name || user.displayName || "Usuario"}
        referrerPolicy="no-referrer" // Google bloquea la foto si el request incluye el header Referer
        onError={() => setImgError(true)}
        className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-green-200`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-green-500 text-white font-bold flex items-center justify-center ring-2 ring-green-200`}
    >
      {initial}
    </div>
  );
}

function Navbar({ backTo, backLabel }) {
  //datos globales de autenticacion y navegacion
  const { user, userRole, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); // ruta actual para ocultar botones de navegacion cuando ya estas en esa pagina

  //estados para controlar la apertura de los menus desplegables (perfil y notificaciones) y para manejar la edicion del WhatsApp de contacto en el menu de perfil (solo para duenos)
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const notifRef = useRef(null);

  // Estados apra la edicion del telefono de contacto solo para owners
  const [editingWsp, setEditingWsp] = useState(false);
  const [tempPhone, setTempPhone] = useState(user?.whatsapp || "");
  const [wspError, setWspError] = useState("");
  const [wspSaving, setWspSaving] = useState(false);

  // estados para el sistema de notificaciones de reservas pendientes para owners
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  //Variables calculadas para simplificar el renderizado
  const displayName = user?.name || user?.displayName || user?.email || "Usuario";
  const isOwner = userRole === "owner" || userRole === "superadmin";

  // trae las reservas en estado pending asignadas al owner actual y resuelve los nombres de las canchas correspondientes en paralelo para mostrar en notificaciones
  const fetchNotifications = async () => {
    if (!isOwner || !user) return;
    //Obtenemos todas las reservas pendientes del usuario logueado
    const snap = await getDocs(
      query(collection(db, "reservations"), where("ownerId", "==", user.uid), where("status", "==", "pending"))
    );
    const reservations = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Extraemos los ids de canchas unicos para evitar consultas duplicadas y resolvemos sus nombres en paralelo con Promise.all  (se podria mejorar con cache global a ver)
    const courtIds = [...new Set(reservations.map(r => r.courtId))];
    const courtNames = {};
    //consultamos las canchas en paralelo utilizando promise.all para optimizar tiempos, y guardamos los nombres en un objeto para referencia rapida al mapear las reservas luego.
    //  Se usa where("__name__", "==", courtId) para traer solo el doc con ese ID sin necesidad de getDoc individual por cada cancha.
    await Promise.all(courtIds.map(async (courtId) => {
// Usamos el campo especial "__name__" para filtrar directamente por el ID del documento en Firestore
      const cSnap = await getDocs(query(collection(db, "courts"), where("__name__", "==", courtId)));
      cSnap.docs.forEach(d => { courtNames[d.id] = d.data().name; });
    }));
    //cruzamos los datos  , asignamos el nomrbre real de la cancha a cada reserva y ordenamos por fecha para mostrar en el dropdown de notificaciones,
    // y seteamos el estado local de notifications para renderizar
    setNotifications(
      reservations
        .map(r => ({ ...r, courtName: courtNames[r.courtId] || "Cancha" }))
        .sort((a, b) => a.date.localeCompare(b.date))
    );
  };
// cambia el estado de una reserva a confirmed en firestore y refresca las notificaciones para reflejar el cambio
  const handleNotifConfirm = async (id) => {
    await updateDoc(doc(db, "reservations", id), { status: "confirmed" });
    fetchNotifications();
  };
  
  // Confirmar reserva desde la campana, actauliza el estado de una reserva a cencelled en firestore y refresca las notificaciones para reflejar el cambio
  const handleNotifReject = async (id) => {
    await updateDoc(doc(db, "reservations", id), { status: "cancelled" });
    fetchNotifications();
  };

  // Cierra la sesion del usuario en firebase y redirige a login
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };
  
  //Limpia, valida e impacta el nuevo numero de wsp en bd y actualiza el estado global de la app para evitar re fetches inecesarios.
  const handleSaveWsp = async () => {
    const clean = tempPhone.replace(/\D/g, "");//remueve cualquier que no sea numero para validar solo el contenido numerico del telefono, y para guardar un formato limpio en la bd sin
    //  espacios ni guiones que puedan complicar futuros usos del numero (ej. para enviar mensajes automaticos)
    if (clean.length < 10) {
      setWspError("Ingresa un numero valido (min. 10 digitos)");
      return;
    }
    setWspError("");
    setWspSaving(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { whatsapp: clean });
      //Sincroniza el cambio en el cotexto global authcontext al instante
      setUser({ ...user, whatsapp: clean }); // propaga el cambio al contexto global para que Reserve.jsx lo lea sin un re-fetch
      setEditingWsp(false);
    } catch {
      setWspError("Error al guardar. Intenta de nuevo.");
    } finally {
      setWspSaving(false);
    }
  };

  //Cancela la edicion del wsp y restablece le input con el valor original.
  const handleCancelWsp = () => {
    setTempPhone(user?.whatsapp || "");
    setWspError("");
    setEditingWsp(false);
  };

  // hook que se dispara el montar el componente y cada vez que el usuario o su rol cambian,
  //  para fetchear las reservas pendientes y mostrarlas en la campana de notificaciones para owners. Si el usuario no es owner o no esta logueado, no hace nada.
  useEffect(() => {
    fetchNotifications();
  }, [user, userRole]);

  // detexta clicks fuera de los menu desplegales de perfil y notificaciones para cerrarlos automaticamente, y ademas cancela la edicion del
  // wsp si el menu de perfil se cierra por click afuera. Se vuelve a configurar el event listener cada vez que cambia el usuario 
  // para evitar fugas de memoria o comportamientos extranos.
  useEffect(() => {
    const handleClickOutside = (e) => {
      //si el menu de perfil esta abierto y el click es fuera de el, cerramos el menu y cancelamos la edicion del wsp para evitar que quede 
      //abierto con un usuario diferente o que se pierda el cambio no guardado al cambiar de usuario.
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        handleCancelWsp();//resetea el formulario de wsp al cerrar el menu por click afuera para evitar que quede abierto con datos de otro usuario o que se pierda el cambio no guardado al cambiar de usuario.
      }
      //si el panel de notifiaciones esta abierto y el click ocurre fuera 
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    //Limpieza del evento al desmontar el componente o al cambiar de usuario para evitar fugas de memoria o comportamientos extranos.
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [user]);

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">

        {/* Logo */}
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate(isOwner ? "/owner" : "/")}
        >
          <span className="font-bold text-gray-900 text-lg">Reservá Tu Cancha</span>
        </div>

        {/* Derecha */}
        <div className="flex items-center gap-2">

          {/* Boton volver */}
          {backTo && (
            <button
              onClick={() => navigate(backTo)}
              className="text-sm text-gray-600 hover:text-green-600 font-medium px-3 py-2 rounded-lg hover:bg-green-50 transition-colors"
            >
              ← {backLabel || "Volver"}
            </button>
          )}

          {/* Mis reservas (solo client, desktop) — se oculta si ya estas en esa pagina para evitar navigate a la misma ruta */}
          {!backTo && userRole === "client" && location.pathname !== "/my-reservations" && (
            <button
              onClick={() => navigate("/my-reservations")}
              className="hidden sm:block text-sm text-gray-600 hover:text-green-600 font-medium px-3 py-2 rounded-lg hover:bg-green-50 transition-colors"
            >
              Mis reservas
            </button>
          )}


          {/* Campana de notificaciones (solo owners) */}
          {isOwner && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setNotifOpen(prev => !prev); setMenuOpen(false); }}
                className="relative p-2 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {/* Badge con conteo */}
                {notifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    {notifications.length > 9 ? "9+" : notifications.length}
                  </span>
                )}
              </button>

              {/* Dropdown de notificaciones */}
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-lg border border-gray-100 z-20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900">Reservas pendientes</p>
                    {notifications.length > 0 && (
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        {notifications.length} nueva{notifications.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-gray-400">Sin reservas pendientes</p>
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                      {notifications.map((notif) => (
                        <div key={notif.id} className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900 truncate">{notif.courtName}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            👤 {notif.clientName} · 📅 {notif.date} · 🕐 {notif.startTime}hs
                          </p>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleNotifConfirm(notif.id)}
                              className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1.5 rounded-lg transition-colors"
                            >
                              ✅ Confirmar
                            </button>
                            <button
                              onClick={() => handleNotifReject(notif.id)}
                              className="flex-1 bg-red-50 hover:bg-red-100 text-red-500 text-xs font-bold py-1.5 rounded-lg transition-colors"
                            >
                              ❌ Rechazar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Avatar + menu desplegable */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => { setMenuOpen((prev) => !prev); setNotifOpen(false); if (menuOpen) handleCancelWsp(); }}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
            >
              <UserAvatar user={user} size="md" />
              <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
                {displayName}
              </span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown de perfil */}
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-20">

                {/* Info usuario */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                  <UserAvatar user={user} size="lg" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                    <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                  </div>
                </div>

                {/* WhatsApp (solo owners) */}
                {isOwner && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <img
                        src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
                        alt="WhatsApp"
                        className="w-4 h-4"
                      />
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        WhatsApp de contacto
                      </p>
                    </div>

                    {editingWsp ? (
                      <>
                        <input
                          value={tempPhone}
                          onChange={(e) => { setTempPhone(e.target.value); setWspError(""); }}
                          placeholder="54911..."
                          autoFocus
                          className="w-full text-sm font-semibold text-gray-900 border border-green-400 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-200 mb-1"
                        />
                        {wspError && (
                          <p className="text-xs text-red-500 mb-1">{wspError}</p>
                        )}
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={handleSaveWsp}
                            disabled={wspSaving}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1.5 rounded-lg transition-colors disabled:opacity-60"
                          >
                            {wspSaving ? "Guardando..." : "Guardar"}
                          </button>
                          <button
                            onClick={handleCancelWsp}
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs font-bold py-1.5 rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-800">
                          {user?.whatsapp ? `+${user.whatsapp}` : "No configurado"}
                        </p>
                        <button
                          onClick={() => { setTempPhone(user?.whatsapp || ""); setEditingWsp(true); }} // no se puede depender del useState inicial porque se captura solo al montar
                          className="text-xs text-green-600 hover:text-green-700 font-semibold hover:underline"
                        >
                          {user?.whatsapp ? "Editar" : "Configurar"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Opciones mobile — misma logica que desktop: se ocultan si ya estas en esa ruta */}
                {userRole === "client" && location.pathname !== "/my-reservations" && (
                  <button
                    onClick={() => { setMenuOpen(false); navigate("/my-reservations"); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors sm:hidden"
                  >
                     Mis reservas
                  </button>
                )}
                {isOwner && location.pathname !== "/owner" && (
                  <button
                    onClick={() => { setMenuOpen(false); navigate("/owner"); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors sm:hidden"
                  >
                     Mi panel
                  </button>
                )}

                {/* Cerrar sesion */}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors rounded-b-2xl"
                >
                   Cerrar sesion
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
