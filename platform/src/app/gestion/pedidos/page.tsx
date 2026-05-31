import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ManagementNav } from "@/components/management-nav";
import { OrdersAdmin } from "@/components/orders-admin";
import { SiteHeader } from "@/components/site-header";
import {
  managementAccessIsEnabled,
  protectedReadsAreEnabled,
  writesAreEnabled,
} from "@/lib/admin-guard";
import { getCommerceState } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Pedidos y entregas",
  description: "Gestión de ventas, confirmación y despacho de BioGranja 51.",
};

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const usingSupabase = isSupabaseConfigured();

  if (usingSupabase && !(await managementAccessIsEnabled())) {
    redirect("/gestion/login");
  }
  const state = await getCommerceState();
  const canReadOrders = await protectedReadsAreEnabled();
  const editable = await writesAreEnabled();

  return (
    <main className="management-page">
      <SiteHeader management />
      <ManagementNav />
      <section className="admin-page-heading">
        <div>
          <p className="eyebrow">Operación comercial</p>
          <h1>Pedidos y entregas</h1>
          <p>
            Confirma ventas, coordina preparación y deja cada entrega lista
            para asociarse a inventario y lotes.
          </p>
        </div>
        <aside className="security-notice">
          <strong>
            {usingSupabase && editable
              ? "Operación autenticada"
              : editable
                ? "Flujo editable local"
                : "Edición protegida"}
          </strong>
          <span>
            {usingSupabase
              ? "Estados protegidos por usuario y permisos en la base operativa."
              : "Los estados se auditarán al conectar la base productiva."}
          </span>
        </aside>
      </section>
      {canReadOrders ? (
        <OrdersAdmin
          initialOrders={state.orders}
          deliveryZones={state.deliveryZones}
          deliveryProfiles={state.deliveryProfiles}
          paymentMethods={state.paymentMethods}
          editable={editable}
        />
      ) : (
        <section className="protected-data-panel">
          <p className="eyebrow">Acceso protegido</p>
          <h2>Pedidos ocultos en producción</h2>
          <p>
            Conecta Supabase Auth y permisos administrativos antes de habilitar
            la consulta de clientes, direcciones y estados de entrega.
          </p>
        </section>
      )}
    </main>
  );
}
