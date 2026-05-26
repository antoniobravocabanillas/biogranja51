import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { StorefrontCatalog } from "@/components/storefront-catalog";
import type { CustomerPortalProfile } from "@/domain/commerce";
import { operatingPillars } from "@/lib/business";
import { getCustomerPortalWorkspace, getStorefrontState } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const whatsappBase = "https://wa.me/51936198468?text=";
  const commerce = await getStorefrontState();
  const products = commerce.products.filter((product) => product.active);
  const deliveryZones = commerce.deliveryZones.filter((zone) => zone.active);
  let signedIn = false;
  let customerProfile: CustomerPortalProfile | null = null;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
    if (signedIn) {
      customerProfile = (await getCustomerPortalWorkspace()).profile;
    }
  }

  return (
    <main className="public-page">
      <SiteHeader />

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">La nueva generación de alimentación confiable</p>
          <h1>
            Proteínas premium,
            <span> confianza en cada entrega.</span>
          </h1>
          <p className="hero-text">
            Pollo criado en nuestra granja y carnes seleccionadas para hogares
            de Trujillo. Origen honesto, compra práctica y una operación
            diseñada para crecer con precisión.
          </p>
          <div className="hero-actions">
            <a className="button-primary" href="#productos">
              Ver productos
            </a>
            <a className="button-secondary" href="#suscripcion">
              Recibir cada semana
            </a>
          </div>
          <dl className="trust-strip">
            <div>
              <dt>Origen claro</dt>
              <dd>Información honesta por producto</dd>
            </div>
            <div>
              <dt>Entrega premium</dt>
              <dd>Coordinada para tu hogar</dd>
            </div>
            <div>
              <dt>Compra recurrente</dt>
              <dd>Weekly Box en preparación</dd>
            </div>
          </dl>
        </div>
        <div className="hero-panel" aria-label="Cadena BioGranja 51">
          <p>Modelo BioGranja 51</p>
          <div className="chain-step active">Molino y alimento</div>
          <div className="chain-line" />
          <div className="chain-step active">Crianza propia</div>
          <div className="chain-line" />
          <div className="chain-step">Carnes seleccionadas</div>
          <div className="chain-line" />
          <div className="chain-step active">Pedido trazable</div>
          <p className="panel-note">
            Cada etapa se convierte en información para el cliente y control
            para la operación.
          </p>
        </div>
      </section>

      <section className="confidence-section" aria-label="Promesa BioGranja 51">
        <div className="confidence-statement">
          <p className="eyebrow">Nuestra promesa</p>
          <h2>No vendemos carne. Vendemos confianza alimentaria.</h2>
        </div>
        <div className="confidence-cards">
          <article>
            <strong>Origen verificable</strong>
            <p>Declaramos producción propia o proveedor seleccionado sin promesas no probadas.</p>
          </article>
          <article>
            <strong>Compra sin fricción</strong>
            <p>Cotiza, elige entrega y registra tu pedido antes de coordinar por WhatsApp.</p>
          </article>
          <article>
            <strong>Operación medible</strong>
            <p>La trazabilidad por lote y el control térmico se activarán con evidencia operativa.</p>
          </article>
        </div>
      </section>

      <section className="section products-section" id="productos">
        <div className="section-heading">
          <p className="eyebrow">Catálogo premium</p>
          <h2>Elige proteína con origen transparente</h2>
          <p>
            Diferenciamos con honestidad lo que producimos de lo que
            seleccionamos, sin sacrificar calidad ni experiencia.
          </p>
        </div>
        <StorefrontCatalog
          products={products}
          deliveryZones={deliveryZones}
          paymentMethods={commerce.paymentMethods}
          signedIn={signedIn}
          customerProfile={customerProfile}
        />
      </section>

      <section className="delivery-experience">
        <div>
          <p className="eyebrow">Entrega BioGranja</p>
          <h2>La entrega también es parte del producto.</h2>
        </div>
        <div className="delivery-features">
          <span>Empaque cuidado</span>
          <span>Etiqueta de origen</span>
          <span>Tarifa por zona</span>
          <span>Coordinación precisa</span>
        </div>
      </section>

      <section className="section model-section" id="modelo">
        <div className="section-heading compact">
          <p className="eyebrow">Empresa escalable</p>
          <h2>El sistema que sostiene la promesa</h2>
        </div>
        <div className="pillar-grid">
          {operatingPillars.map((pillar, index) => (
            <article key={pillar.name}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{pillar.name}</h3>
              <p>{pillar.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="subscription" id="suscripcion">
        <div>
          <p className="eyebrow">Proteína por suscripción</p>
          <h2>BioGranja Weekly Box</h2>
          <p>
            Packs familiares, fitness y parrilleros con entrega semanal o
            quincenal. Regístrate para validar frecuencia, contenido y zona
            antes del lanzamiento de la suscripción.
          </p>
        </div>
        <div className="subscription-actions">
          <a
            className="button-primary"
            href={`${whatsappBase}${encodeURIComponent(
              "Hola BioGranja 51, me interesa la BioGranja Weekly Box semanal o quincenal.",
            )}`}
            target="_blank"
            rel="noreferrer"
          >
            Unirme a la lista
          </a>
          <Link href="/gestion">Ver plataforma operativa</Link>
        </div>
      </section>

      <footer className="site-footer">
        <div className="brand footer-brand">
          <span className="brand-leaf" aria-hidden="true" />
          <span>
            <strong>BioGranja</strong>
            <b>51</b>
          </span>
        </div>
        <p>Proteínas, nutrición animal y producción circular.</p>
        <p>Trujillo, Perú | BioGranja 51 E.I.R.L. | 2026</p>
      </footer>
    </main>
  );
}
