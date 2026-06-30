import { useState, useRef, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase/config";
// onSnapshot reemplaza a getDocs para mantener las notificaciones en tiempo real
// getDocs se sigue usando solo para resolver nombres de canchas (dato estatico secundario)
import { doc, updateDoc, setDoc, collection, getDocs, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

// Componente de avatar circular con fallback a inicial si no hay foto o falla la carga
function UserAvatar({ user, size = "md" }) {
  // flag para detectar error de carga de imagen (ej: bloqueo CORS de Google)
  const [imgError, setImgError] = useState(false);

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
  // datos globales de autenticacion, rol y funcion para actualizar el usuario en contexto
  const { user, userRole, setUser } = useAuth();
  const navigate = useNavigate();
  // ruta actual para ocultar botones de navegacion cuando ya estas en esa pagina
  const location = useLocation();

  // refs para detectar clicks fuera de los menus y cerrarlos automaticamente
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const notifRef = useRef(null);

  // estados para la edicion del telefono de contacto (solo para owners)
  const [editingWsp, setEditingWsp] = useState(false);
  const [tempPhone, setTempPhone] = useState(user?.whatsapp || "");
  const [wspError, setWspError] = useState("");
  const [wspSaving, setWspSaving] = useState(false);

  // estados para el dropdown de notificaciones
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // variables calculadas para simplificar el renderizado
  const displayName = user?.name || user?.displayName || user?.email || "Usuario";
  const isOwner = userRole === "owner" || userRole === "superadmin";

  // Listener en tiempo real de reservas pendientes del owner.
  // onSnapshot reemplaza al patron fetch manual: cada vez que cambia una reserva en Firestore
  // el callback se dispara automaticamente y actualiza el badge y el dropdown sin recargar.
  // Los nombres de canchas se resuelven con getDocs dentro del callback porque son datos secundarios
  // que cambian poco y no justifican un segundo listener permanente.
  useEffect(() => {
    if (!isOwner || !user) return;

    const q = query(
      collection(db, "reservations"),
      where("ownerId", "==", user.uid),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, async (snap) => {
      const reservations = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // deduplicamos los courtIds para no consultar la misma cancha mas de una vez
      const courtIds = [...new Set(reservations.map(r => r.courtId))];
      const courtNames = {};
      // resolvemos los nombres de canchas en paralelo con Promise.all
      await Promise.all(courtIds.map(async (courtId) => {
        // "__name__" filtra directamente por ID de documento sin necesitar getDoc individual
        const cSnap = await getDocs(query(collection(db, "courts"), where("__name__", "==", courtId)));
        cSnap.docs.forEach(d => { courtNames[d.id] = d.data().name; });
      }));

      // cruzamos reservas con nombres de canchas y ordenamos por fecha para el dropdown
      setNotifications(
        reservations
          .map(r => ({ ...r, courtName: courtNames[r.courtId] || "Cancha" }))
          .sort((a, b) => a.date.localeCompare(b.date))
      );
    });

    // cancelamos el listener al desmontar o cuando cambia el usuario/rol
    return () => unsub();
  }, [user, userRole]);

  // Confirma una reserva desde la campana — onSnapshot actualiza el badge automaticamente.
  // Sincronizamos tambien el slot para que la grilla de disponibilidad refleje el estado real.
  const handleNotifConfirm = async (notif) => {
    await updateDoc(doc(db, "reservations", notif.id), { status: "confirmed" });
    await updateDoc(doc(db, "slots", `${notif.courtId}_${notif.date}_${notif.startTime}`), { status: "confirmed" });
  };

  // Rechaza una reserva desde la campana — onSnapshot elimina la notificacion automaticamente.
  // Marcamos el slot como cancelado para liberar el turno (vuelve a ser reservable).
  const handleNotifReject = async (notif) => {
    await updateDoc(doc(db, "reservations", notif.id), { status: "cancelled" });
    await updateDoc(doc(db, "slots", `${notif.courtId}_${notif.date}_${notif.startTime}`), { status: "cancelled" });
  };

  // cierra la sesion del usuario en Firebase y redirige al login
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // limpia, valida y guarda el numero de WhatsApp del owner en Firestore y en el contexto global
  const handleSaveWsp = async () => {
    // removemos caracteres no numericos para guardar solo digitos en la BD
    const clean = tempPhone.replace(/\D/g, "");
    if (clean.length < 10) {
      setWspError("Ingresa un numero valido (min. 10 digitos)");
      return;
    }
    setWspError("");
    setWspSaving(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { whatsapp: clean });
      // Espejamos el numero en /ownerContacts (dato publico acotado) para que Reserve.jsx
      // lo lea sin necesidad de leer el doc /users del owner (que ahora es privado).
      await setDoc(doc(db, "ownerContacts", user.uid), { whatsapp: clean });
      // propagamos el cambio al contexto global para que Reserve.jsx lo lea sin un re-fetch
      setUser({ ...user, whatsapp: clean });
      setEditingWsp(false);
    } catch {
      setWspError("Error al guardar. Intenta de nuevo.");
    } finally {
      setWspSaving(false);
    }
  };

  // cancela la edicion del wsp y restaura el valor original en el input
  const handleCancelWsp = () => {
    setTempPhone(user?.whatsapp || "");
    setWspError("");
    setEditingWsp(false);
  };

  // detecta clicks fuera de los menus desplegables para cerrarlos automaticamente
  // y cancela la edicion del wsp si el menu de perfil se cierra por click afuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        handleCancelWsp();
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    // limpieza del event listener al desmontar o al cambiar de usuario para evitar fugas de memoria
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [user]);

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">

        {/* Logo — redirige al panel del owner o al home segun el rol */}
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate(isOwner ? "/owner" : "/")}
        >
          <span className="font-bold text-gray-900 text-lg">Reservá Tu Cancha</span>
        </div>

        <div className="flex items-center gap-2">

          {/* Boton volver — solo aparece cuando el Navbar recibe la prop backTo */}
          {backTo && (
            <button
              onClick={() => navigate(backTo)}
              className="text-sm text-gray-600 hover:text-green-600 font-medium px-3 py-2 rounded-lg hover:bg-green-50 transition-colors"
            >
              ← {backLabel || "Volver"}
            </button>
          )}

          {/* Mis reservas (solo client, desktop) — se oculta si ya estas en esa pagina */}
          {!backTo && userRole === "client" && location.pathname !== "/my-reservations" && (
            <button
              onClick={() => navigate("/my-reservations")}
              className="hidden sm:block text-sm text-gray-600 hover:text-green-600 font-medium px-3 py-2 rounded-lg hover:bg-green-50 transition-colors"
            >
              Mis reservas
            </button>
          )}

          {/* Campana de notificaciones en tiempo real (solo owners) */}
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
                {/* Badge con conteo de reservas pendientes — se actualiza en tiempo real */}
                {notifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    {notifications.length > 9 ? "9+" : notifications.length}
                  </span>
                )}
              </button>

              {/* Dropdown de notificaciones con acciones de confirmar y rechazar */}
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
                              onClick={() => handleNotifConfirm(notif)}
                              className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1.5 rounded-lg transition-colors"
                            >
                              ✅ Confirmar
                            </button>
                            <button
                              onClick={() => handleNotifReject(notif)}
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

          {/* Avatar + menu desplegable de perfil */}
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

            {/* Dropdown de perfil con info del usuario, edicion de WhatsApp y opciones de navegacion */}
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-20">

                {/* Info del usuario logueado */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                  <UserAvatar user={user} size="lg" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                    <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                  </div>
                </div>

                {/* Edicion de WhatsApp de contacto (solo owners) */}
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
                          onClick={() => { setTempPhone(user?.whatsapp || ""); setEditingWsp(true); }} // no depende del useState inicial porque se captura solo al montar
                          className="text-xs text-green-600 hover:text-green-700 font-semibold hover:underline"
                        >
                          {user?.whatsapp ? "Editar" : "Configurar"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Opciones de navegacion mobile — se ocultan si ya estas en esa ruta */}
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
