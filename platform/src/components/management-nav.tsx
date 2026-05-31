"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const managementSections = [
  {
    title: "Venta y clientes",
    links: [
      { href: "/gestion", label: "Resumen" },
      { href: "/gestion/pedidos", label: "Pedidos y entregas" },
      { href: "/gestion/clientes", label: "Clientes" },
      { href: "/gestion/finanzas", label: "Finanzas" },
    ],
  },
  {
    title: "Producción",
    links: [
      { href: "/gestion/crianza", label: "Crianza avícola" },
      { href: "/gestion/huevos", label: "Huevos y ponedoras" },
      { href: "/gestion/molino", label: "Molino y fórmulas" },
    ],
  },
  {
    title: "Control",
    links: [
      { href: "/gestion/inventario", label: "Inventario comercial" },
      { href: "/gestion/auditoria", label: "Auditoria" },
      { href: "/gestion/expedientes", label: "Expedientes" },
    ],
  },
  {
    title: "Sistema",
    links: [
      { href: "/gestion/productos", label: "Productos y precios" },
      { href: "/gestion/configuracion", label: "Configuración operativa" },
    ],
  },
];

export function ManagementNav() {
  const pathname = usePathname();

  return (
    <nav className="management-nav" aria-label="Gestión">
      <div className="management-nav-title">
        <p>Centro de gestión</p>
        <strong>Operación BioGranja</strong>
      </div>
      {managementSections.map((section) => (
        <section className="management-nav-group" key={section.title}>
          <p>{section.title}</p>
          {section.links.map((link) => {
            const active =
              link.href === "/gestion"
                ? pathname === link.href
                : pathname.startsWith(link.href);
            return (
              <Link className={active ? "active" : ""} href={link.href} key={link.href}>
                {link.label}
              </Link>
            );
          })}
        </section>
      ))}
      <form action="/api/auth/logout" method="post">
        <button type="submit">Cerrar sesión</button>
      </form>
    </nav>
  );
}
