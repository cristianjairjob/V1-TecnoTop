"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Layers,
  Folder,
  ShoppingBag,
  Users,
  RefreshCw,
  Boxes,
  Truck,
  Tag,
  Settings,
  LogOut,
  Plus,
  Save,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { money } from "@/lib/catalog-format";
import { formatDeliveryDate } from "@/lib/delivery";
type Row = Record<string, unknown>;
const string = (r: Row, k: string) => String(r[k] ?? "");
const rows = (v: unknown) => (Array.isArray(v) ? (v as Row[]) : []);
const navigation = [
  { id: "dashboard", name: "Resumen", Icon: LayoutDashboard },
  { id: "products", name: "Productos", Icon: Package },
  { id: "categories", name: "Categorías", Icon: Layers },
  { id: "collections", name: "Colecciones", Icon: Folder },
  { id: "orders", name: "Pedidos", Icon: ShoppingBag },
  { id: "customers", name: "Clientes", Icon: Users },
  { id: "dropi", name: "Dropi", Icon: RefreshCw },
  { id: "inventory", name: "Inventario", Icon: Boxes },
  { id: "tracking", name: "Seguimiento", Icon: Truck },
  { id: "promotions", name: "Promociones", Icon: Tag },
  { id: "settings", name: "Configuración", Icon: Settings },
];
async function api(resource: string, body?: unknown) {
  const r = await fetch(
    `/api/admin/${resource}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const j = await r.json();
  if (!r.ok) throw new Error(j.error + (j.code ? ` (${j.code})` : ""));
  return j;
}
function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: unknown;
  onChange: (v: unknown) => void;
  type?: string;
}) {
  return (
    <label>
      {label}
      {type === "checkbox" ? (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      ) : type === "textarea" ? (
        <textarea
          value={String(value ?? "")}
          rows={5}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          value={String(value ?? "")}
          onChange={(e) =>
            onChange(
              type === "number"
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
    </label>
  );
}
export function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel login-panel" onSubmit={submit}>
      <span className="eyebrow">TECNOTOP · ADMINISTRACIÓN</span>
      <h1>Bienvenido de nuevo.</h1>
      <p>Ingresa con tu cuenta de administrador.</p>
      <label>
        Correo
        <input type="email" name="email" autoComplete="username" required />
      </label>
      <label>
        Contraseña
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button className="button full" disabled={busy}>
        {busy ? "Ingresando…" : "Entrar al panel"}
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </form>
  );
}
export function Admin() {
  const router = useRouter();
  const [section, setSection] = useState("dashboard");
  const [data, setData] = useState<unknown>(null);
  const [cats, setCats] = useState<Row[]>([]);
  const [products, setProducts] = useState<Row[]>([]);
  const [edit, setEdit] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [keywords, setKeywords] = useState("");
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([
      api(`${section}?page=${page}`),
      api("categories"),
      api("products"),
    ])
      .then(([d, c, p]) => {
        if (active) {
          setData(d);
          setCats(c);
          setProducts(p);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [section, page, revision]);
  function choose(id: string) {
    setSection(id);
    setData(null);
    setEdit(null);
    setPage(0);
    setMessage("");
    setError("");
  }
  async function mutate(resource: string, body: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api(resource, body);
      setMessage("Cambios guardados.");
      setRevision((r) => r + 1);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible guardar.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  function update(key: string, value: unknown) {
    setEdit((e) => (e ? { ...e, [key]: value } : e));
  }
  function open(r: Row) {
    let value = { ...r };
    if (section === "products" || section === "inventory") {
      value = {
        ...r,
        salePrice: r.salePrice === null ? null : Number(r.salePrice),
        previousPrice:
          r.previousPrice === null ? null : Number(r.previousPrice),
        images: rows([]),
        imageText: (r.images as string[]).join("\n"),
        variants: rows(r.variants).map((v) => ({
          ...v,
          salePrice: v.salePrice === null ? null : Number(v.salePrice),
        })),
      };
    }
    if (section === "collections")
      value = { ...r, productIds: rows(r.products).map((p) => p.productId) };
    if (section === "promotions")
      value = {
        ...r,
        minimum: Number(r.minimum),
        startsAt: string(r, "startsAt").slice(0, 16),
        endsAt: string(r, "endsAt").slice(0, 16),
      };
    setEdit(value);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    let body = { ...edit };
    if (section === "products")
      body = {
        ...body,
        images: String(edit.imageText ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    if (section === "promotions")
      body = {
        ...body,
        startsAt: new Date(String(body.startsAt)).toISOString(),
        endsAt: new Date(String(body.endsAt)).toISOString(),
      };
    const result = await mutate(section, body);
    if (result) setEdit(null);
  }
  const list = rows(data);
  const dashboard = data && !Array.isArray(data) ? (data as Row) : {};
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <span className="eyebrow">CENTRO DE CONTROL</span>
        <h2>
          TecnoTop <small>Admin</small>
        </h2>
        <nav>
          {navigation.map(({ id, name, Icon }) => (
            <button
              className={section === id ? "active" : ""}
              key={id}
              onClick={() => choose(id)}
            >
              <Icon size={18} />
              {name}
            </button>
          ))}
        </nav>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/admin/login");
            router.refresh();
          }}
        >
          <LogOut size={17} /> Cerrar sesión
        </button>
      </aside>
      <div className="admin-content">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TU TIENDA, BAJO CONTROL</span>
            <h1>{navigation.find((n) => n.id === section)?.name}</h1>
          </div>
          {["categories", "collections", "promotions"].includes(section) && (
            <button
              className="button"
              onClick={() =>
                setEdit(
                  section === "promotions"
                    ? {
                        code: "",
                        title: "",
                        percent: 10,
                        minimum: 0,
                        active: false,
                        startsAt: new Date().toISOString().slice(0, 16),
                        endsAt: new Date(Date.now() + 7 * 86400000)
                          .toISOString()
                          .slice(0, 16),
                      }
                    : {
                        name: "",
                        slug: "",
                        description: "",
                        position: 0,
                        visible: true,
                        ...(section === "collections"
                          ? {
                              categoryId: string(cats[0] ?? {}, "id"),
                              productIds: [],
                            }
                          : {}),
                      },
                )
              }
            >
              <Plus size={17} /> Crear
            </button>
          )}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="success-message" role="status">
            {message}
          </p>
        )}
        {data === null && !error && <p>Cargando…</p>}
        {section === "dashboard" && data !== null && (
          <>
            <div className="stat-grid">
              {[
                ["products", "Productos"],
                ["drafts", "Por revisar"],
                ["orders", "Pedidos"],
                ["errors", "Errores de pedidos"],
              ].map(([k, l]) => (
                <div key={k}>
                  <span>{l}</span>
                  <strong>{string(dashboard, k)}</strong>
                </div>
              ))}
            </div>
            <div className="panel">
              <h2>Estado de la tienda</h2>
              <p>
                Token Dropi:{" "}
                {dashboard.dropiConfigured
                  ? "configurado (consulta Dropi para verificar acceso)"
                  : "pendiente"}
              </p>
              <p>
                Envío real de órdenes:{" "}
                {dashboard.ordersEnabled ? "habilitado" : "deshabilitado"}
              </p>
              <p>
                Checkout:{" "}
                {dashboard.checkoutEnabled
                  ? "habilitado por entorno; requiere políticas aprobadas"
                  : "deshabilitado"}
              </p>
              <p>
                Los productos importados quedan en borrador hasta confirmar
                precio y clasificación. Los reintentos con resultado desconocido
                se bloquean para evitar órdenes duplicadas.
              </p>
            </div>
          </>
        )}
        {section === "dropi" && (
          <div className="panel">
            <h2>Catálogo e inventario</h2>
            <DropiDiagnostic />
            <p>
              Importa páginas de 10 productos. La sincronización conserva
              precios y clasificación de TecnoTop.
            </p>
            <div className="catalog-filters">
              <input
                aria-label="Buscar en Dropi"
                value={keywords}
                onChange={(e) => {
                  setKeywords(e.target.value);
                  setOffset(0);
                }}
                placeholder="Palabra clave en Dropi"
              />
              <button
                disabled={busy}
                className="button"
                onClick={async () => {
                  const r = await mutate("dropi-import", { offset, keywords });
                  if (r) {
                    setOffset(r.data.hasMore ? r.data.nextOffset : 0);
                    setMessage(
                      `${r.data.count} productos importados en borrador.${r.data.hasMore ? " Puedes importar la página siguiente." : " Fin de resultados."}`,
                    );
                  }
                }}
              >
                {busy
                  ? "Consultando…"
                  : `Importar ${offset ? "siguiente página" : "primera página"}`}
              </button>
              <button
                disabled={busy}
                className="button secondary"
                onClick={async () => {
                  let cursor = 0;
                  let more = true;
                  while (more) {
                    const r = await mutate("dropi-sync", { offset: cursor });
                    if (!r) break;
                    cursor = r.data.nextOffset;
                    more = r.data.hasMore;
                  }
                  setMessage("Sincronización terminada; consulta el registro.");
                }}
              >
                Sincronizar inventario
              </button>
            </div>
            <p className="small">
              Cotización de transporte y seguimiento automático: endpoints
              pendientes de verificación. No se crean órdenes con estas
              acciones.
            </p>
          </div>
        )}
        {section === "settings" &&
          list.map((setting) => (
            <SettingsEditor
              key={string(setting, "key")}
              setting={setting}
              busy={busy}
              onSave={(v) => mutate("settings", { key: setting.key, value: v })}
            />
          ))}
        {edit &&
          ["products", "categories", "collections", "promotions"].includes(
            section,
          ) && (
            <form className="panel editor" onSubmit={save}>
              <div className="section-heading">
                <h2>{edit.id ? "Editar" : "Crear"}</h2>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setEdit(null)}
                >
                  Cerrar
                </button>
              </div>
              <div className="form-grid">
                {section === "products" ? (
                  <>
                    <Field
                      label="Nombre"
                      value={edit.name}
                      onChange={(v) => update("name", v)}
                    />
                    <Field
                      label="Marca"
                      value={edit.brand}
                      onChange={(v) => update("brand", v)}
                    />
                    <Field
                      label="Precio de venta COP"
                      type="number"
                      value={edit.salePrice}
                      onChange={(v) => update("salePrice", v)}
                    />
                    <Field
                      label="Precio anterior COP"
                      type="number"
                      value={edit.previousPrice}
                      onChange={(v) => update("previousPrice", v)}
                    />
                    <p>
                      Costo proveedor: {money(Number(edit.supplierPrice))}
                      <br />
                      Margen:{" "}
                      {Number(edit.salePrice) > 0
                        ? `${Math.round(((Number(edit.salePrice) - Number(edit.supplierPrice)) / Number(edit.salePrice)) * 100)}%`
                        : "Pendiente"}
                    </p>
                    <label>
                      Estado
                      <select
                        value={string(edit, "status")}
                        onChange={(e) => update("status", e.target.value)}
                      >
                        <option value="DRAFT">Borrador</option>
                        <option value="PUBLISHED">Publicado</option>
                        <option value="ARCHIVED">Archivado</option>
                      </select>
                    </label>
                    <Field
                      label="Descripción"
                      type="textarea"
                      value={edit.description}
                      onChange={(v) => update("description", v)}
                    />
                    <Field
                      label="Imágenes HTTPS (una URL por línea)"
                      type="textarea"
                      value={edit.imageText}
                      onChange={(v) => update("imageText", v)}
                    />
                    <Field
                      label="Destacado"
                      type="checkbox"
                      value={edit.featured}
                      onChange={(v) => update("featured", v)}
                    />
                    <Field
                      label="Popular"
                      type="checkbox"
                      value={edit.popular}
                      onChange={(v) => update("popular", v)}
                    />
                    {rows(edit.variants).map((v, i) => (
                      <Field
                        key={string(v, "id")}
                        label={`Precio variante: ${v.name}`}
                        type="number"
                        value={v.salePrice}
                        onChange={(value) =>
                          update(
                            "variants",
                            rows(edit.variants).map((v, n) =>
                              n === i ? { ...v, salePrice: value } : v,
                            ),
                          )
                        }
                      />
                    ))}
                  </>
                ) : section === "promotions" ? (
                  <>
                    {[
                      ["code", "Código"],
                      ["title", "Título"],
                      ["percent", "Descuento %"],
                      ["minimum", "Compra mínima COP"],
                      ["startsAt", "Inicio"],
                      ["endsAt", "Fin"],
                      ["active", "Activa"],
                    ].map(([k, l]) => (
                      <Field
                        key={k}
                        label={l}
                        value={edit[k]}
                        onChange={(v) => update(k, v)}
                        type={
                          k === "active"
                            ? "checkbox"
                            : ["percent", "minimum"].includes(k)
                              ? "number"
                              : ["startsAt", "endsAt"].includes(k)
                                ? "datetime-local"
                                : "text"
                        }
                      />
                    ))}
                  </>
                ) : (
                  <>
                    <Field
                      label="Nombre"
                      value={edit.name}
                      onChange={(v) => update("name", v)}
                    />
                    <Field
                      label="URL (minúsculas y guiones)"
                      value={edit.slug}
                      onChange={(v) => update("slug", v)}
                    />
                    <Field
                      label="Descripción"
                      type="textarea"
                      value={edit.description}
                      onChange={(v) => update("description", v)}
                    />
                    <Field
                      label="Visible"
                      type="checkbox"
                      value={edit.visible}
                      onChange={(v) => update("visible", v)}
                    />
                  </>
                )}
                {["products", "collections"].includes(section) && (
                  <label>
                    Categoría
                    <select
                      value={string(edit, "categoryId")}
                      onChange={(e) =>
                        update("categoryId", e.target.value || null)
                      }
                    >
                      <option value="">Pendiente de clasificación</option>
                      {cats.map((c) => (
                        <option value={string(c, "id")} key={string(c, "id")}>
                          {string(c, "name")}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {section !== "promotions" && (
                  <Field
                    label="Posición"
                    type="number"
                    value={edit.position}
                    onChange={(v) => update("position", v)}
                  />
                )}
              </div>
              {section === "collections" && (
                <div>
                  <h3>Productos y orden</h3>
                  <p className="small">
                    Selecciona productos de la misma categoría. Usa las flechas
                    para ordenar.
                  </p>
                  {(edit.productIds as string[]).map((pid, i) => (
                    <div className="collection-editor-row" key={pid}>
                      <span>
                        {string(
                          products.find((p) => p.id === pid) ?? { name: pid },
                          "name",
                        )}
                      </span>
                      <button
                        type="button"
                        aria-label="Subir producto"
                        disabled={i === 0}
                        onClick={() => {
                          const ids = [...(edit.productIds as string[])];
                          [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                          update("productIds", ids);
                        }}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Quitar producto"
                        onClick={() =>
                          update(
                            "productIds",
                            (edit.productIds as string[]).filter(
                              (x) => x !== pid,
                            ),
                          )
                        }
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  <select
                    aria-label="Agregar producto a colección"
                    value=""
                    onChange={(e) => {
                      if (e.target.value)
                        update("productIds", [
                          ...(edit.productIds as string[]),
                          e.target.value,
                        ]);
                    }}
                  >
                    <option value="">Agregar producto…</option>
                    {products
                      .filter(
                        (p) =>
                          p.categoryId === edit.categoryId &&
                          !(edit.productIds as string[]).includes(String(p.id)),
                      )
                      .map((p) => (
                        <option key={string(p, "id")} value={string(p, "id")}>
                          {string(p, "name")}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <button className="button" disabled={busy}>
                <Save size={17} /> Guardar cambios
              </button>
            </form>
          )}
        {!["dashboard", "settings"].includes(section) && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {section === "products" || section === "inventory" ? (
                    <>
                      <th>Producto</th>
                      <th>Estado</th>
                      <th>Stock</th>
                      <th>Precio</th>
                      <th>Acción</th>
                    </>
                  ) : section === "orders" || section === "tracking" ? (
                    <>
                      <th>Pedido</th>
                      <th>Cliente</th>
                      <th>Estado</th>
                      <th>Total</th>
                      <th>Acción</th>
                    </>
                  ) : section === "customers" ? (
                    <>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Celular</th>
                    </>
                  ) : section === "dropi" ? (
                    <>
                      <th>Operación</th>
                      <th>Estado</th>
                      <th>Cantidad</th>
                      <th>Código</th>
                      <th>Fecha</th>
                    </>
                  ) : (
                    <>
                      <th>Nombre</th>
                      <th>Estado</th>
                      <th>Orden / descuento</th>
                      <th>Acción</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={string(r, "id")}>
                    {section === "products" || section === "inventory" ? (
                      <>
                        <td>
                          <strong>{string(r, "name")}</strong>
                          <small>
                            Dropi {string(r, "dropiId")} ·{" "}
                            {string(r, "supplierName") ||
                              string(r, "supplierId") ||
                              "Proveedor pendiente"}
                          </small>
                          <small>
                            Sincronizado:{" "}
                            {r.syncedAt
                              ? new Date(String(r.syncedAt)).toLocaleString(
                                  "es-CO",
                                )
                              : "Pendiente"}
                          </small>
                        </td>
                        <td>
                          <span className="badge">{string(r, "status")}</span>
                        </td>
                        <td>{string(r, "stock")}</td>
                        <td>
                          {r.salePrice
                            ? money(Number(r.salePrice))
                            : "Pendiente"}
                        </td>
                        <td>
                          <button
                            onClick={() => {
                              if (section === "inventory")
                                setSection("products");
                              open(r);
                            }}
                          >
                            Editar
                          </button>
                        </td>
                      </>
                    ) : section === "orders" || section === "tracking" ? (
                      <>
                        <td>
                          <strong>{string(r, "number")}</strong>
                          <small>
                            {new Date(string(r, "createdAt")).toLocaleString(
                              "es-CO",
                            )}
                          </small>
                        </td>
                        <td>{string(r.customer as Row, "name")}</td>
                        <td>
                          {string(r, "status")}
                          <small>
                            {r.dropi ? string(r.dropi as Row, "outcome") : ""}
                          </small>
                        </td>
                        <td>{money(Number(r.total))}</td>
                        <td>
                          <button
                            onClick={() =>
                              setEdit(edit?.id === r.id ? null : r)
                            }
                          >
                            Ver detalle
                          </button>
                          {section === "orders" && (
                            <button
                              disabled={
                                busy ||
                                Boolean(
                                  r.dropi &&
                                  ["UNKNOWN", "SENDING", "ACCEPTED"].includes(
                                    string(r.dropi as Row, "outcome"),
                                  ),
                                )
                              }
                              onClick={async () => {
                                const result = await mutate("order-send", {
                                  id: r.id,
                                });
                                if (result)
                                  setMessage(
                                    result.data.sent
                                      ? "Pedido aceptado por Dropi."
                                      : `Envío no realizado: ${result.data.reason}`,
                                  );
                              }}
                            >
                              Enviar / reintentar
                            </button>
                          )}
                        </td>
                      </>
                    ) : section === "customers" ? (
                      <>
                        <td>{string(r, "name")}</td>
                        <td>{string(r, "email")}</td>
                        <td>{string(r, "phone")}</td>
                      </>
                    ) : section === "dropi" ? (
                      <>
                        <td>{string(r, "operation")}</td>
                        <td>{string(r, "status")}</td>
                        <td>{string(r, "count")}</td>
                        <td>{string(r, "errorCode")}</td>
                        <td>
                          {new Date(string(r, "createdAt")).toLocaleString(
                            "es-CO",
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          {string(r, "name") || string(r, "title")}
                          <small>
                            {string(r, "slug") || string(r, "code")}
                          </small>
                        </td>
                        <td>
                          {r.visible || r.active
                            ? "Visible / activa"
                            : "Oculta / inactiva"}
                        </td>
                        <td>{string(r, "position") || string(r, "percent")}</td>
                        <td>
                          <button onClick={() => open(r)}>Editar</button>
                          {section === "collections" && (
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "¿Eliminar esta colección? Los productos se conservarán.",
                                  )
                                )
                                  void mutate("collection-delete", {
                                    id: r.id,
                                  });
                              }}
                            >
                              Eliminar
                            </button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && (
              <p className="table-empty">No hay registros en esta sección.</p>
            )}
          </div>
        )}
        {edit && ["orders", "tracking"].includes(section) && (
          <div className="panel">
            <h2>Pedido {string(edit, "number")}</h2>
            <p>
              Cliente: {string(edit.customer as Row, "name")} ·{" "}
              {string(edit.customer as Row, "phone")} ·{" "}
              {string(edit.customer as Row, "email")}
            </p>
            <p>Dirección: {["address", "complement", "city", "state"].map((key) => string(edit.address as Row, key)).filter(Boolean).join(" · ")}</p>
            <DeliveryDetails key={string(edit, "id")} order={edit} />
            {rows(edit.items).map((i) => (
              <p key={string(i, "id")}>
                {string(i, "quantity")} × {string(i, "name")} ·{" "}
                {money(Number(i.unitPrice))}
              </p>
            ))}
            <p>
              Dropi:{" "}
              {edit.dropi
                ? string(edit.dropi as Row, "originalId") ||
                  string(edit.dropi as Row, "outcome")
                : "No enviado"}
            </p>
            <h3>Eventos registrados</h3>
            {rows(edit.events).map((e) => (
              <p key={string(e, "id")}>
                {string(e, "status")}: {string(e, "detail")}
              </p>
            ))}
            {section === "tracking" && (
              <TrackingEditor
                orderId={string(edit, "id")}
                busy={busy}
                onSave={(v) => mutate("tracking", v)}
              />
            )}
          </div>
        )}
        {!["dashboard", "categories", "collections", "settings"].includes(
          section,
        ) && (
          <div className="pagination">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              ← Anterior
            </button>
            <span>Página {page + 1}</span>
            <button
              disabled={list.length < 50}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
function DropiDiagnostic() {
  const [result, setResult] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <section aria-label="Conexión con Dropi">
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true); setError(""); setResult(null);
      try { setResult(await api("dropi-diagnostic")); }
      catch (e) { setError(e instanceof Error ? e.message : "No se pudo comprobar la conexión."); }
      finally { setBusy(false); }
    }}>{busy ? "Comprobando…" : "Comprobar conexión con Dropi"}</button>
    <p className="small">Consulta un producto sin importarlo ni crear pedidos. No habilita ventas.</p>
    {error && <p role="alert">{error}</p>}
    {result && <div role="status">
      <p>{result.connected ? "Conexión verificada" : `Conexión rechazada o no verificada (HTTP ${result.httpStatus})`}</p>
      {result.accessDenied === true && <p>Dropi respondió Access denied. Solicita revisar la autorización de la integración, dominio e IP.</p>}
      {Boolean(result.observedIp) && <p>IP que recibe Dropi: {string(result, "observedIp")}</p>}
      <p>Última comprobación: {string(result, "checkedAt")}</p>
    </div>}
  </section>;
}
function DeliveryDetails({ order }: { order: Row }) {
  const [copyStatus, setCopyStatus] = useState("");
  const address = order.address as Row;
  const delivery = (address.delivery ?? {}) as Row;
  const buyer = (address.buyer ?? order.customer) as Row;
  const notes = string(order, "deliveryNotes");
  return (
    <section aria-label="Información adicional de entrega">
      <h3>Información adicional de entrega</h3>
      <p>Nombres: {string(buyer, "firstName") || "Sin registrar por separado (pedido anterior)"}</p>
      <p>Apellidos: {string(buyer, "lastName") || "Sin registrar por separado (pedido anterior)"}</p>
      <p>Nombre del local: {string(delivery, "establishment") || "Sin registrar"}</p>
      <p>Referencia: {string(delivery, "reference") || "Sin registrar"}</p>
      <p>Fecha solicitada: {formatDeliveryDate(string(delivery, "requestedDate"))}</p>
      <p>La fecha solicitada está sujeta a disponibilidad y confirmación de la transportadora.</p>
      <h3>Notas para Dropi · Texto exacto del payload</h3>
      {notes ? <>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit" }}>{notes}</pre>
        <button type="button" onClick={async () => {
          try {
            await navigator.clipboard.writeText(notes);
            setCopyStatus("Notas copiadas.");
          } catch {
            setCopyStatus("No se pudo copiar automáticamente. Selecciona el texto para copiarlo.");
          }
        }}>Copiar notas</button>
        <p role="status">{copyStatus}</p>
      </> : <p>Pedido anterior sin notas estructuradas. Requiere revisión antes de enviarlo a Dropi.</p>}
      <p>El estado de Dropi indica si el envío fue aceptado. Las notas se conservan aunque falle.</p>
    </section>
  );
}
function SettingsEditor({
  setting,
  busy,
  onSave,
}: {
  setting: Row;
  busy: boolean;
  onSave: (v: unknown) => Promise<unknown>;
}) {
  const [value, setValue] = useState(setting.value);
  const home = setting.key === "home";
  if (!["home", "store"].includes(String(setting.key))) return null;
  return (
    <form
      className="panel editor"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(value);
      }}
    >
      <h2>{home ? "Secciones de inicio" : "Contacto y políticas"}</h2>
      {home ? (
        rows(value).map((s, i) => (
          <div className="home-editor-row" key={string(s, "id")}>
            <div className="section-heading">
              <strong>{string(s, "id")}</strong>
              <div>
                <button
                  type="button"
                  aria-label="Subir sección"
                  disabled={i === 0}
                  onClick={() => {
                    const a = [...rows(value)];
                    [a[i - 1], a[i]] = [a[i], a[i - 1]];
                    setValue(a);
                  }}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Bajar sección"
                  disabled={i === rows(value).length - 1}
                  onClick={() => {
                    const a = [...rows(value)];
                    [a[i + 1], a[i]] = [a[i], a[i + 1]];
                    setValue(a);
                  }}
                >
                  <ArrowDown size={15} />
                </button>
              </div>
            </div>
            {[
              ["title", "Título"],
              ["subtitle", "Subtítulo"],
              ["visible", "Visible"],
            ].map(([k, l]) => (
              <Field
                key={k}
                label={l}
                value={s[k]}
                type={k === "visible" ? "checkbox" : "text"}
                onChange={(v) =>
                  setValue(
                    rows(value).map((r, n) => (n === i ? { ...r, [k]: v } : r)),
                  )
                }
              />
            ))}
          </div>
        ))
      ) : (
        <div className="form-grid">
          {[
            ["contactEmail", "Correo de atención"],
            ["whatsapp", "WhatsApp con código de país"],
            ["legalName", "Nombre del titular / razón social"],
            ["taxId", "NIT (si corresponde)"],
            ["address", "Dirección del titular"],
            ["privacy", "Privacidad y tratamiento de datos"],
            ["shipping", "Envíos y pago"],
            ["returns", "Cambios, devoluciones y garantías"],
            ["terms", "Condiciones de compra"],
            ["policiesApproved", "He revisado y aprobado las políticas"],
          ].map(([k, l]) => (
            <Field
              key={k}
              label={l}
              value={(value as Row)[k]}
              type={
                k === "policiesApproved"
                  ? "checkbox"
                  : ["privacy", "shipping", "returns", "terms"].includes(k)
                    ? "textarea"
                    : "text"
              }
              onChange={(v) => setValue({ ...(value as Row), [k]: v })}
            />
          ))}
        </div>
      )}
      <button className="button" disabled={busy}>
        <Save size={17} /> Guardar configuración
      </button>
    </form>
  );
}
function TrackingEditor({
  orderId,
  busy,
  onSave,
}: {
  orderId: string;
  busy: boolean;
  onSave: (v: unknown) => Promise<unknown>;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          orderId,
          ...Object.fromEntries(new FormData(e.currentTarget)),
        });
      }}
    >
      <h3>Registrar un evento verificado</h3>
      <p>
        Registra únicamente estados comprobados. La evidencia queda en
        auditoría.
      </p>
      <div className="form-grid">
        <label>
          Estado
          <select name="status">
            {[
              "VALIDANDO",
              "GUIA_GENERADA",
              "EN_TRANSITO",
              "EN_REPARTO",
              "ENTREGADO",
              "DEVUELTO",
              "CANCELADO",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Detalle visible al cliente
          <input name="detail" required minLength={8} />
        </label>
        <label>
          Guía (si existe)
          <input name="guide" />
        </label>
        <label>
          Transportadora
          <input name="carrier" />
        </label>
        <label>
          Evidencia / referencia comprobada
          <input name="evidence" required minLength={8} />
        </label>
      </div>
      <button className="button" disabled={busy}>
        Registrar evento
      </button>
    </form>
  );
}
