import Link from "next/link";

export function ManagementNav() {
  return (
    <nav className="management-nav" aria-label="Gestión">
      <Link href="/gestion">Resumen</Link>
      <Link href="/gestion/pedidos">Pedidos y entregas</Link>
      <Link href="/gestion/clientes">Clientes</Link>
      <Link href="/gestion/crianza">Crianza avícola</Link>
      <Link href="/gestion/huevos">Huevos y ponedoras</Link>
      <Link href="/gestion/inventario">Inventario comercial</Link>
      <Link href="/gestion/productos">Productos y precios</Link>
      <Link href="/gestion/configuracion">Configuración operativa</Link>
      <form action="/api/auth/logout" method="post">
        <button type="submit">Cerrar sesión</button>
      </form>
    </nav>
  );
}
