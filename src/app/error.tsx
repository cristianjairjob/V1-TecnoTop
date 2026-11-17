"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="wrap empty-state">
      <h1>Estamos recuperando la conexión</h1>
      <p>
        No pudimos cargar esta página. Inténtalo de nuevo en unos instantes.
      </p>
      <button className="button" onClick={reset}>
        Volver a intentar
      </button>
    </div>
  );
}
