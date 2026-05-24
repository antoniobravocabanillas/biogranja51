"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import type { OriginType, PriceUnit, Product } from "@/domain/commerce";
import { formatPrice, originLabels } from "@/domain/commerce";

type ProductAdminProps = {
  initialProducts: Product[];
  editable: boolean;
};

type ProductDraft = Omit<Product, "id">;

const emptyProduct: ProductDraft = {
  sku: "",
  name: "",
  category: "Pollo",
  originType: "pending_confirmation",
  description: "",
  presentation: "",
  priceUnit: "unit",
  price: null,
  portionGrams: null,
  imageUrl: null,
  active: true,
  subscriptionEligible: true,
  traceable: true,
};

function fromProduct(product: Product): ProductDraft {
  return {
    sku: product.sku,
    name: product.name,
    category: product.category,
    originType: product.originType,
    description: product.description,
    presentation: product.presentation,
    priceUnit: product.priceUnit,
    price: product.price,
    portionGrams: product.portionGrams,
    imageUrl: product.imageUrl,
    active: product.active,
    subscriptionEligible: product.subscriptionEligible,
    traceable: product.traceable,
  };
}

export function ProductAdmin({ initialProducts, editable }: ProductAdminProps) {
  const [products, setProducts] = useState(initialProducts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(emptyProduct);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  function selectProduct(product: Product) {
    setSelectedId(product.id);
    setDraft(fromProduct(product));
    setMessage("");
  }

  function createNew() {
    setSelectedId(null);
    setDraft(emptyProduct);
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable) {
      setMessage("Activa autenticación administrativa para guardar en producción.");
      return;
    }

    setSaving(true);
    setMessage("");
    const target = selectedId ? `/api/catalogo/${selectedId}` : "/api/catalogo";
    const response = await fetch(target, {
      method: selectedId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const result = (await response.json()) as Product & { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo guardar el producto.");
      setSaving(false);
      return;
    }

    setProducts((current) =>
      selectedId
        ? current.map((product) => (product.id === selectedId ? result : product))
        : [result, ...current],
    );
    setSelectedId(result.id);
    setDraft(fromProduct(result));
    setMessage("Producto guardado. La tienda reflejará este cambio.");
    setSaving(false);
  }

  async function toggleActive(product: Product) {
    if (!editable) {
      return;
    }
    const response = await fetch(`/api/catalogo/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !product.active }),
    });
    if (response.ok) {
      const updated = (await response.json()) as Product;
      setProducts((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      if (selectedId === updated.id) {
        setDraft(fromProduct(updated));
      }
    }
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    if (!image || !editable) {
      return;
    }

    setUploading(true);
    setMessage("");
    const payload = new FormData();
    payload.append("image", image);
    const response = await fetch("/api/media/productos", {
      method: "POST",
      body: payload,
    });
    const result = (await response.json()) as { imageUrl?: string; error?: string };
    if (!response.ok || !result.imageUrl) {
      setMessage(result.error || "No se pudo subir la imagen.");
    } else {
      setDraft((current) => ({ ...current, imageUrl: result.imageUrl! }));
      setMessage("Imagen cargada. Guarda el producto para publicarla.");
    }
    setUploading(false);
  }

  return (
    <section className="admin-editor-grid">
      <div className="records-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Catálogo</p>
            <h2>{products.length} productos registrados</h2>
          </div>
          <button type="button" onClick={createNew}>
            Nuevo producto
          </button>
        </div>
        <div className="admin-product-list">
          {products.map((product) => (
            <article key={product.id} className={selectedId === product.id ? "selected" : ""}>
              <button className="record-select" type="button" onClick={() => selectProduct(product)}>
                <span className={`origin-pill origin-${product.originType}`}>
                  {originLabels[product.originType]}
                </span>
                <strong>{product.name}</strong>
                <small>{product.presentation}</small>
                <b>{formatPrice(product)}</b>
              </button>
              <button
                className={`record-state ${product.active ? "active" : ""}`}
                type="button"
                onClick={() => toggleActive(product)}
              >
                {product.active ? "Publicado" : "Oculto"}
              </button>
            </article>
          ))}
        </div>
      </div>

      <form className="edit-form" onSubmit={submit}>
        <div className="form-title">
          <div>
            <p className="eyebrow">{selectedId ? "Editar" : "Crear"}</p>
            <h2>{selectedId ? draft.name : "Nuevo producto"}</h2>
          </div>
          {!editable ? <span className="locked-pill">Solo lectura</span> : null}
        </div>
        <div className="field-pair">
          <label className="form-field">
            <span>Nombre</span>
            <input
              required
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label className="form-field">
            <span>SKU</span>
            <input
              required
              value={draft.sku}
              onChange={(event) => setDraft({ ...draft, sku: event.target.value })}
            />
          </label>
        </div>
        <div className="field-pair">
          <label className="form-field">
            <span>Categoría</span>
            <input
              value={draft.category}
              onChange={(event) => setDraft({ ...draft, category: event.target.value })}
            />
          </label>
          <label className="form-field">
            <span>Origen</span>
            <select
              value={draft.originType}
              onChange={(event) =>
                setDraft({ ...draft, originType: event.target.value as OriginType })
              }
            >
              <option value="own">Producción propia</option>
              <option value="selected_supplier">Proveedor seleccionado</option>
              <option value="pending_confirmation">Origen por confirmar</option>
            </select>
          </label>
        </div>
        <label className="form-field">
          <span>Presentación</span>
          <input
            required
            value={draft.presentation}
            onChange={(event) => setDraft({ ...draft, presentation: event.target.value })}
            placeholder="Ej. Porción de 500 g"
          />
        </label>
        <label className="form-field">
          <span>Descripción comercial</span>
          <textarea
            rows={3}
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </label>
        <div className="field-triple">
          <label className="form-field">
            <span>Se cobra por</span>
            <select
              value={draft.priceUnit}
              onChange={(event) =>
                setDraft({ ...draft, priceUnit: event.target.value as PriceUnit })
              }
            >
              <option value="unit">Unidad</option>
              <option value="maple">Maple</option>
              <option value="kg">Kilogramo</option>
            </select>
          </label>
          <label className="form-field">
            <span>Precio (S/)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={draft.price ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  price: event.target.value ? Number(event.target.value) : null,
                })
              }
            />
          </label>
          <label className="form-field">
            <span>Gramos por presentación</span>
            <input
              type="number"
              min="0"
              value={draft.portionGrams ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  portionGrams: event.target.value ? Number(event.target.value) : null,
                })
              }
            />
          </label>
        </div>
        <label className="form-field">
          <span>Imagen del producto</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={!editable || uploading}
            onChange={uploadImage}
          />
        </label>
        <label className="form-field">
          <span>Ruta o URL de imagen</span>
          <input
            value={draft.imageUrl ?? ""}
            onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value || null })}
            placeholder="/uploads/productos/... o https://..."
          />
        </label>
        <div className="checkbox-row">
          <label>
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
            />
            Publicado
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.subscriptionEligible}
              onChange={(event) =>
                setDraft({ ...draft, subscriptionEligible: event.target.checked })
              }
            />
            Disponible para suscripción
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.traceable}
              onChange={(event) => setDraft({ ...draft, traceable: event.target.checked })}
            />
            Trazable por lote
          </label>
        </div>
        {message ? <p className="form-message">{message}</p> : null}
        <button className="save-button" type="submit" disabled={saving || !editable}>
          {saving ? "Guardando..." : "Guardar producto"}
        </button>
      </form>
    </section>
  );
}
