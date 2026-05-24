import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Home from "./pages/Home";
import OwnerPanel from "./pages/OwnerPanel";
import Reserve from "./pages/Reserve";
import MyReservations from "./pages/MyReservations";
import NotFound from "./pages/NotFound";

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/" />;
}

function OwnerRoute({ children }) {
  const { user, userRole } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (userRole !== "owner" && userRole !== "superadmin") return <Navigate to="/" />;
  return children;
}

// redirige segun el rol al entrar a la raiz
function RootRoute({ children }) {
  const { user, userRole } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (userRole === "owner" || userRole === "superadmin") return <Navigate to="/owner" />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          <PublicRoute><Login /></PublicRoute>
        } />
        {/* la raíz ahora redirige según el rol */}
        <Route path="/" element={
          <RootRoute><Home /></RootRoute>
        } />
        <Route path="/owner" element={
          <OwnerRoute><OwnerPanel /></OwnerRoute>
        } />
        <Route path="/reserve/:courtId" element={
          <PrivateRoute><Reserve /></PrivateRoute>
        } />
        <Route path="/my-reservations" element={
          <PrivateRoute><MyReservations /></PrivateRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;