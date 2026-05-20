import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase/config";
import { useNavigate } from "react-router-dom";

const provider = new GoogleAuthProvider();

function Login() {
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleGoogle = async () => {
    try {
      await signInWithPopup(auth, provider);
      navigate("/");
    } catch {
      setError("Error al iniciar sesion con Google. Intenta de nuevo.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">

        {/* Logo */}
        <div className="text-center mb-10">
          <span className="text-5xl">⚽</span>
          <h1 className="text-3xl font-bold text-gray-900 mt-3">Reservá Tu Cancha</h1>
          <p className="text-gray-500 mt-2">La forma más fácil de reservar tu turno</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-5">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 text-gray-700 font-semibold py-4 rounded-xl transition-all shadow-sm text-base"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" />
          Continuar con Google
        </button>

        <p className="text-center text-xs text-gray-400 mt-6">
          Al ingresar aceptás los términos de uso del servicio
        </p>

      </div>
    </div>
  );
}

export default Login;
