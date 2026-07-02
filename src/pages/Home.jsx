import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";

function Home() {
  const [courts, setCourts] = useState([]); // Guardamos la lista de canchas, arrancamos en vacio
  const [loading, setLoading] = useState(true); //empieza en true avisando que esta cargando para mostrar el incono de caarga mientrass se traen los datos 
  const { user } = useAuth();
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
        //aca se hace la consulta a firebase para traer las canchas disponibles
        const q = query(collection(db, "courts"), where("available","==", true));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc)=>({id: doc.id, ...doc.data()}));

        //comparamos si existen cambios antes de forzar el renderizado
        if(JSON.stringify(data)!== cachedCourts){
          setCourts(data);
          // actualizamos nuestra cache para la proxima vez
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

      <Navbar />

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
                    {court.ownerId !== user.uid && ( // validacion de seguridad para que el dueño de la cancha no pueda reservar su propia cancha
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