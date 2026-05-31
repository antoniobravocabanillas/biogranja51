import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ManagementNav } from "@/components/management-nav";
import { SiteHeader } from "@/components/site-header";
import { managementModules } from "@/lib/business";
import { managementAccessIsEnabled, protectedReadsAreEnabled } from "@/lib/admin-guard";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCommerceState } from "@/lib/commerce-store";

export const metadata: Metadata = {
  title: "Centro de Gestión",
  description:
    "Vista operativa de ventas, producción, molino y trazabilidad de BioGranja 51.",
};

export const dynamic = "force-dynamic";

export default async function GestionPage() {
  if (isSupabaseConfigured() && !(await managementAccessIsEnabled())) {
    redirect("/gestion/login");
  }
  const commerce = await getCommerceState();
  const orders = (await protectedReadsAreEnabled()) ? commerce.orders : [];
  const pricesConfigured = commerce.products.filter((product) => product.price !== null).length;
  const currentMonth = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(new Date());
  const monthOrders = orders.filter(
    (order) =>
      new Intl.DateTimeFormat("en-CA", {
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Lima",
      }).format(new Date(order.createdAt)) === currentMonth,
  );
  const activeOrders = monthOrders.filter((order) => order.status !== "cancelled");
  const orderValue = activeOrders.reduce((sum, order) => sum + (order.total ?? 0), 0);
  const pendingOrders = activeOrders.filter((order) => order.status === "pending_confirmation").length;
  const deliveredOrders = activeOrders.filter((order) => order.status === "delivered").length;
  const kpis = [
    {
      label: "Pedidos del mes",
      value: String(monthOrders.length),
      note: `${pendingOrders} pendientes de confirmación`,
    },
    {
      label: "Venta estimada",
      value: `S/ ${orderValue.toFixed(2)}`,
      note: "Totales con precio definido",
    },
    {
      label: "Entregas completas",
      value: String(deliveredOrders),
      note: "Pedidos entregados",
    },
    {
      label: "Trazabilidad",
      value: `${commerce.products.filter((product) => product.traceable).length}/${commerce.products.length}`,
      note: "Productos preparados",
    },
  ];

  return (
    <main className="management-page">
      <SiteHeader management />
      <ManagementNav />
      <section className="dashboard-intro">
        <div>
          <p className="eyebrow">Centro de gestión</p>
          <h1>Control integral de la operación</h1>
          <p>
            Un sistema para vender hoy y controlar mañana la producción,
            nutrición, abastecimiento y circularidad.
          </p>
        </div>
        <div className="prototype-label">
          <span />
          Catálogo operativo - Sprint 1
        </div>
      </section>

      <section className="kpi-grid" aria-label="Indicadores ejecutivos">
        {kpis.map((kpi) => (
          <article key={kpi.label}>
            <p>{kpi.label}</p>
            <strong>{kpi.value}</strong>
            <span>{kpi.note}</span>
          </article>
        ))}
      </section>

      <section className="management-content">
        <div className="module-panel">
          <div className="panel-heading">
            <div>
            <p className="eyebrow">Módulos</p>
              <h2>Mapa operativo</h2>
            </div>
            <Link className="planned-action" href="/gestion/pedidos">
              Gestionar pedidos
            </Link>
          </div>
          <div className="module-list">
            {managementModules.map((module) => (
              <article key={module.code}>
                <span className="module-code">{module.code}</span>
                <div>
                  <h3>{module.name}</h3>
                  <p>{module.description}</p>
                </div>
                <small>{module.status}</small>
              </article>
            ))}
          </div>
        </div>

        <aside className="trace-panel">
          <p className="eyebrow">Trazabilidad</p>
          <h2>Lote BG-POL-0001</h2>
          <p className="muted">
            Ejemplo de la información que acompañará al pollo propio desde la
            crianza hasta el pedido.
          </p>
          <ol>
            <li>
              <strong>Fórmula de alimento</strong>
              <span>Inicio / crecimiento / engorde</span>
            </li>
            <li>
              <strong>Crianza y peso</strong>
              <span>Registro diario y rendimiento</span>
            </li>
            <li>
              <strong>Preparación y frío</strong>
              <span>Fecha, responsable y control</span>
            </li>
            <li>
              <strong>Cliente y entrega</strong>
              <span>Pedido asociado al lote</span>
            </li>
          </ol>
        </aside>
      </section>
      <section className="release-strip">
        <strong>{pricesConfigured}/{commerce.products.length} precios configurados</strong>
        <span>
          Completa pollo, huevos, res y cerdo para habilitar cotizaciones con total definitivo.
        </span>
        <Link href="/gestion/productos">Completar catálogo</Link>
      </section>
    </main>
  );
}
