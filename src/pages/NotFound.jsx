import { useNavigate } from "react-router-dom";

function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <span className="text-7xl">⚽</span>
        <h1 className="text-6xl font-black text-gray-200 mt-4">404</h1>
        <p className="text-xl font-bold text-gray-900 mt-2">Esta página no existe</p>
        <p className="text-gray-500 mt-1">La ruta que buscás no se encontró.</p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}

export default NotFound;
