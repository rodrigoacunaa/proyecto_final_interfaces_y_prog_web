import { useState } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase/config";
import { useNavigate } from "react-router-dom";

const provider = new GoogleAuthProvider();

const errorMessage = (code) => {
  switch (code) {
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Email o contraseña incorrectos.";
    case "auth/email-already-in-use":
      return "Ya existe una cuenta con ese email.";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres.";
    case "auth/invalid-email":
      return "El email no es válido.";
    case "auth/too-many-requests":
      return "Demasiados intentos fallidos. Esperá unos minutos.";
    default:
      return "Ocurrió un error. Intentá de nuevo.";
  }
};

function Login() {
  // mode: "login" | "register" | "forgot"
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setInfo("");
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithPopup(auth, provider);
      navigate("/");
    } catch {
      setError("Error al iniciar sesión con Google. Intentá de nuevo.");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      setError(errorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Ingresá tu nombre."); return; }
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name.trim() });
      navigate("/");
    } catch (err) {
      setError(errorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setInfo("Te mandamos un email para restablecer tu contraseña. Revisá tu bandeja (y la carpeta de spam).");
    } catch (err) {
      setError(errorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const subtitle = {
    login: "La forma más fácil de reservar tu turno",
    register: "Creá tu cuenta gratis",
    forgot: "Recuperá tu contraseña",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">

        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-5xl">⚽</span>
          <h1 className="text-3xl font-bold text-gray-900 mt-3">Reservá Tu Cancha</h1>
          <p className="text-gray-500 mt-2">{subtitle[mode]}</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-5">
            {error}
          </div>
        )}
        {info && (
          <div className="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-3 mb-5">
            {info}
          </div>
        )}

        {/* Google (no en forgot) */}
        {mode !== "forgot" && (
          <>
            <button
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 text-gray-700 font-semibold py-4 rounded-xl transition-all shadow-sm text-base"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" />
              Continuar con Google
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-medium">o con tu email</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
          </>
        )}

        {/* Formulario login */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <div className="text-right">
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="text-xs text-green-600 hover:underline font-medium"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </button>
          </form>
        )}

        {/* Formulario registro */}
        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-3">
            <input
              type="text"
              placeholder="Nombre completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <input
              type="password"
              placeholder="Contraseña (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>
        )}

        {/* Formulario recuperar contraseña */}
        {mode === "forgot" && !info && (
          <form onSubmit={handleForgot} className="space-y-3">
            <input
              type="email"
              placeholder="Tu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "Enviando..." : "Enviar email de recuperación"}
            </button>
          </form>
        )}

        {/* Toggle de modo */}
        <div className="text-center mt-6 text-sm text-gray-500">
          {mode === "login" && (
            <>¿No tenés cuenta?{" "}
              <button onClick={() => switchMode("register")} className="text-green-600 font-semibold hover:underline">
                Creá una gratis
              </button>
            </>
          )}
          {mode === "register" && (
            <>¿Ya tenés cuenta?{" "}
              <button onClick={() => switchMode("login")} className="text-green-600 font-semibold hover:underline">
                Iniciá sesión
              </button>
            </>
          )}
          {mode === "forgot" && (
            <button onClick={() => switchMode("login")} className="text-green-600 font-semibold hover:underline">
              ← Volver al inicio de sesión
            </button>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Al ingresar aceptás los términos de uso del servicio
        </p>

      </div>
    </div>
  );
}

export default Login;
