import Link from "next/link";

type SiteHeaderProps = {
  management?: boolean;
};

export function SiteHeader({ management = false }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand-leaf" aria-hidden="true" />
        <span>
          <strong>BioGranja</strong>
          <b>51</b>
        </span>
      </Link>
      <nav className="site-nav" aria-label="Principal">
        {management ? (
          <>
            <Link href="/">Sitio comercial</Link>
            <Link href="/gestion/pedidos">Pedidos</Link>
            <Link href="/gestion/productos">Productos</Link>
            <Link className="nav-action" href="/gestion">Gestión</Link>
          </>
        ) : (
          <>
            <a className="nav-secondary" href="#productos">Productos</a>
            <a className="nav-secondary" href="#modelo">Nuestro origen</a>
            <Link className="nav-account" href="/cuenta">Mi cuenta</Link>
            <Link className="nav-action" href="/#productos">
              Comprar
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
