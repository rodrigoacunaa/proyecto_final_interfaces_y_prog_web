import { useRef, useState } from "react";

/**
 * Hook para proteger acciones async contra doble-click / multi-submit.
 * Combina useRef (bloqueo síncrono inmediato) con useState (feedback de UI).
 *
 * Uso:
 *   const { run, loading } = useAsyncAction();
 *   const handleSubmit = () => run(async () => { await addDoc(...); });
 *
 * El botón puede usar `disabled={loading}` para dar feedback visual.
 */
export function useAsyncAction() {
  const inFlight = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async (fn) => {
    // El ref bloquea de forma sincrona antes de cualquier re-render
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err?.message || "Ocurrió un error inesperado. Intentá de nuevo.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return { run, loading, error };
}
