import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Home() {
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCourts = async () => {
      //comprobamos caché local primeramente
      const cachedCourts = sessionStorage.getItem("courtsCache");
      if(cachedCourts){
        setCourts(JSON.parse(cachedCourts));

        setLoading(false); // off loading porque tenemos al instante los datos
      }

      //revisamos cambios en firebase
      try{
        const q = query(collection(db, "courts"), where("available","==", true));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc)=>({id: doc.id, ...doc.data()}));

        //comparamos si existen cambios antes de forzar el renderizado
        if(JSON.stringify(data)!== cachedCourts){
          setCourts(data);
          // actualizamos nuestra caché para la proxima vez
          sessionStorage.setItem("courtsCache", JSON.stringify(data));
        }
      } catch (error){
        console.error("Error obteniendo canchas de Firebase: ",error);
      } finally {
        // si es la primera vez que se entra y no había caché
        setLoading(false);
      }
    };
    fetchCourts();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const sportEmoji = (sport) => {
    const emojis = { futbol: "⚽", padel: "🎾", tenis: "🎾", basquet: "🏀" };
    return emojis[sport] || "🏅";
  };

  const sportLabel = (sport) => {
    const labels = { futbol: "Fútbol", padel: "Pádel", tenis: "Tenis", basquet: "Básquet" };
    return labels[sport] || sport;
  };

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
            {userRole === "client" && (
              <button
                onClick={() => navigate("/my-reservations")}
                className="text-sm text-gray-600 hover:text-green-600 font-medium px-3 py-2 rounded-lg hover:bg-green-50 transition-colors"
              >
                Mis reservas
              </button>
            )}
            {(userRole === "owner" || userRole === "superadmin") && (
              <button
                onClick={() => navigate("/owner")}
                className="text-sm text-gray-600 hover:text-green-600 font-medium px-3 py-2 rounded-lg hover:bg-green-50 transition-colors"
              >
                Mi panel
              </button>
            )}
            <button
              onClick={handleLogout}
              className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-2">Encontrá tu cancha</h2>
          <p className="text-green-100 text-lg">Reservá en segundos, jugá sin esperas</p>
        </div>
      </div>

      {/* Canchas */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Cargando canchas...</div>
        ) : courts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">No hay canchas disponibles por el momento.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courts.map((court) => (
              <div key={court.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                {/* Card header */}
                <div className="bg-gradient-to-br from-green-400 to-emerald-500 p-6 flex items-center justify-center">
                  <span className="text-5xl">{sportEmoji(court.sport)}</span>
                </div>
                {/* Card body */}
                <div className="p-4">
                  <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    {sportLabel(court.sport)}
                  </span>
                  <h3 className="font-bold text-gray-900 mt-2 text-lg">{court.name}</h3>
                  <p className="text-gray-500 text-sm mt-1">📍 {court.location}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="font-bold text-gray-900">${court.price}<span className="text-gray-400 font-normal text-sm">/hora</span></span>
                    {court.ownerId !== user.uid && (
                      <button
                        onClick={() => navigate(`/reserve/${court.id}`)}
                        className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                      >
                        Reservar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;