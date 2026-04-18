import { useState } from "react";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/config";
import { useNavigate } from "react-router-dom";

const provider = new GoogleAuthProvider();

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/");
    } catch (err) {
      setError("Email o contraseña incorrectos");
    }
  };

  const handleGoogle = async () => {
    try {
      await signInWithPopup(auth, provider);
      navigate("/");
    } catch (err) {
      setError("Error al iniciar sesión con Google");
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "100px auto", padding: "2rem" }}>
      <h1>CourtBook 🏟️</h1>
      <h2>{isRegistering ? "Registrarse" : "Iniciar sesión"}</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleEmailAuth}>
        <div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: "block", width: "100%", marginBottom: "1rem", padding: "0.5rem" }}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ display: "block", width: "100%", marginBottom: "1rem", padding: "0.5rem" }}
          />
          <button type="submit" style={{ width: "100%", padding: "0.5rem" }}>
            {isRegistering ? "Registrarse" : "Iniciar sesión"}
          </button>
        </div>
      </form>

      <button onClick={handleGoogle} style={{ width: "100%", padding: "0.5rem", marginTop: "1rem" }}>
        Iniciar sesión con Google 🔵
      </button>

      <p style={{ marginTop: "1rem", cursor: "pointer", color: "blue" }} onClick={() => setIsRegistering(!isRegistering)}>
        {isRegistering ? "¿Ya tenés cuenta? Iniciá sesión" : "¿No tenés cuenta? Registrate"}
      </p>
    </div>
  );
}

export default Login;