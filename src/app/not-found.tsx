import Link from "next/link";
export default function NotFound() {
  return (
    <div className="wrap empty-state">
      <h1>No encontramos esta página</h1>
      <p>Explora el catálogo para encontrar lo que buscas.</p>
      <Link href="/catalogo" className="button">
        Ir al catálogo
      </Link>
    </div>
  );
}
