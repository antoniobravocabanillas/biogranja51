// =====================
// Datos de Recetas
// =====================
const imageBase = "/img/recetas/";

const recetas = [
  {
    id: "pollo-hierbas-andinas",
    slug: "pollo-rostizado",
    ext: "png",
    titulo: "Pollo Rostizado con Hierbas Andinas y Quinua Cremosa",
    preview: "Aromas de muña y huacatay en un pollo jugoso con quinua cremosa y vegetales asados.",
    descripcion: "Inspirado en técnicas francesas y alma andina. Nuestro pollo BioGranja 51 (30 días) se macera en hierbas y se hornea lentamente para lograr piel crujiente y carne jugosa. Acompañado de quinua cremosa y vegetales asados.",
    porciones: 4,
    tiempo: "75 min",
    dificultad: "Media",
    ingredientes: [
      "Pollo entero BioGranja (1.6–1.8 kg) - 1 und",
      "Ajo - 4 dientes",
      "Limón - 1 und (zumo y ralladura)",
      "Muña fresca - 1 cda (o menta suave)",
      "Huacatay - 1 cda",
      "Mantequilla - 40 g",
      "Aceite de oliva - 2 cdas",
      "Sal de Maras - c/n",
      "Pimienta negra - c/n",
      "Quinua blanca - 250 g",
      "Caldo de pollo natural - 600 ml",
      "Cebolla chalota - 1 und",
      "Parmesano rallado - 30 g (opcional)",
      "Zanahoria, zapallito, pimiento - 400 g en total"
    ],
    tecnica: "Sellado inicial y horneado controlado a 200°C bajando a 180°C. Se glasea con mantequilla y hierbas para una piel crujiente y brillo tenue. La guarnición se cocina por absorción con caldo y termina como una 'quinua risottata'.",
    pasos: [
      "Precalienta el horno a 200°C. Seca muy bien el pollo, sala y pimienta generosamente.",
      "Prepara un untado con ajo, muña, huacatay, mantequilla, limón (zumo y ralladura) y aceite de oliva. Unta por dentro y fuera del pollo.",
      "Coloca el pollo sobre una rejilla o cama de vegetales. Hornea 20 min a 200°C y baja a 180°C por 30–35 min más. Baña con sus jugos a mitad de cocción.",
      "Para la quinua: sofríe chalota picada, añade la quinua lavada, nacara 2–3 min y agrega el caldo caliente en tandas. Cocina 14–16 min, termina con parmesano y un hilo de oliva.",
      "Asa los vegetales con sal, pimienta y un toque de aceite hasta dorar.",
      "Deja reposar el pollo 8–10 min antes de cortar. Glasea con sus jugos colados."
    ],
    presentacion: "Sirve la quinua como base, dispón trozos del pollo, vegetales asados a los costados y termina con gotas del jugo reducido. Decora con plumas de muña fresca.",
    maridaje: "Vino blanco Sauvignon Blanc o infusión fría de muña con limón."
  },
  {
    id: "cuy-doblemente-horneado",
    slug: "cuy-al-horno-doble",
    ext: "png",
    titulo: "Cuy al Horno Doble con Salsa Criolla Templada",
    preview: "Corteza crocante, carne jugosa, tradición peruana con técnica moderna.",
    descripcion: "Una versión de autor del cuy tradicional: curado breve, horneado en dos temperaturas para optimizar textura, acompañado de salsa criolla templada y papas nativas.",
    porciones: 2,
    tiempo: "80 min",
    dificultad: "Media",
    ingredientes: [
      "Cuy entero limpio BioGranja - 2 und",
      "Sal de Maras y pimienta - c/n",
      "Ajo - 3 dientes",
      "Ají panca - 1 cda",
      "Comino - 1/2 cdta",
      "Vinagre de vino o chicha - 1 cda",
      "Papas nativas - 400 g",
      "Aceite - c/n",
      "Cebolla roja - 1 und",
      "Ají amarillo en tiras - 1 und",
      "Cilantro - 1 cda picado",
      "Limón - 1 und",
      "Sal fina - c/n"
    ],
    tecnica: "Curado breve con especias, horneado a 160°C y final crocante a 220°C. Se acompaña de papas nativas asadas y una criolla templada (no cruda) para mayor elegancia.",
    pasos: [
      "Mezcla ajo, ají panca, comino, vinagre, sal y pimienta. Unta los dos cuyes y deja curar 30–40 min en frío.",
      "Hornea a 160°C durante 35–40 min sobre rejilla. Sube a 220°C por 8–10 min para dorar y crocancia.",
      "Cocina papas nativas con piel, luego aplástalas levemente y dóralas en sartén con aceite y sal.",
      "Para la criolla: sofríe suavemente cebolla en pluma y ají amarillo por 1–2 min, apaga con limón y agrega cilantro y sal.",
      "Deja reposar los cuyes 5 min antes de cortar."
    ],
    presentacion: "Sirve medio cuy por persona, acompaña con papas doradas y la criolla templada encima. Finaliza con gotas de aceite de oliva y pimienta recién molida.",
    maridaje: "Chicha de jora fresca o cerveza artesanal dorada."
  },
  {
    id: "pollo-cuy-duo",
    slug: "duo-pollo-cuy",
    ext: "png",
    titulo: "Dúo de Pollo & Cuy con Quinua Negra y Emulsión de Ají Amarillo",
    preview: "Una experiencia de autor: texturas contrastantes y un hilo de emulsión vibrante.",
    descripcion: "Propuesta de alto nivel que combina pechuga de pollo sellada al punto y pulpa de cuy confitada, servidas con quinua negra y una emulsión sedosa de ají amarillo.",
    porciones: 4,
    tiempo: "85 min",
    dificultad: "Avanzada",
    ingredientes: [
      "Pechugas de pollo BioGranja - 2 und (250–300 g c/u)",
      "Pulpa de cuy - 400 g",
      "Aceite de oliva - c/n",
      "Ajo - 3 dientes",
      "Tomillo - 1 cdta",
      "Sal y pimienta - c/n",
      "Quinua negra - 220 g",
      "Caldo de verduras - 600 ml",
      "Mantequilla - 20 g",
      "Ají amarillo fresco - 2 und",
      "Leche (o bebida vegetal) - 80 ml",
      "Limón - unas gotas",
      "Sal de Maras - c/n"
    ],
    tecnica: "Confitado suave de la pulpa de cuy a 95°C y sellado preciso de la pechuga a 65–68°C. Emulsión de ají amarillo blanqueado para sedosidad y color limpio.",
    pasos: [
      "Confitado del cuy: sala y pimienta la pulpa, cúbrela con aceite, agrega ajo y tomillo. Cocina a 90–95°C por 60–75 min hasta muy tierno. Desmenuza.",
      "Pechuga: sala, pimienta y sella a fuego medio-alto con aceite hasta dorar ligera. Termina al horno a 170°C por 8–10 min (punto jugoso). Reposa 5 min.",
      "Quinua negra: lava bien, sofríe 1 min, añade caldo caliente y cocina 18–20 min. Termina con mantequilla.",
      "Emulsión de ají: blanquea ajíes 2 veces, licua con leche, sal y gotas de limón hasta sedoso.",
      "Calienta la pulpa confitada, rectifica sal y pimienta."
    ],
    presentacion: "En un plato amplio, base de quinua negra; a un lado, pechuga fileteada. Al otro, montículo de pulpa de cuy. Traza una línea de emulsión de ají amarillo y decora con microhierbas.",
    maridaje: "Vino rosé seco o limonada de hierbaluisa con hielo."
  }
];

// =====================
// Renderizado de Cards
// =====================
function renderRecetas() {
  const contenedor = document.getElementById("recetas-container");
  if (!contenedor) return;

  contenedor.innerHTML = recetas.map((r, idx) => {
   const img = `${imageBase}${r.slug}.${r.ext}`;
    return `
      <div class="receta-card">
        <img src="${img}" alt="${r.titulo}" loading="lazy">
        <div class="receta-card-content">
          <h3>${r.titulo}</h3>
          <p>${r.preview}</p>
          <button class="btn-receta" onclick="openReceta(${idx})">Ver receta completa</button>
        </div>
      </div>`;
  }).join("");
}

// =====================
// Modal Lógica
// =====================
function openReceta(index) {
  const r = recetas[index];
  if (!r) return console.warn("Receta no encontrada:", index);

  // Asegurar que los elementos existen
  const tituloEl = document.getElementById("modal-titulo");
  const imagenEl = document.getElementById("modal-imagen");
  const descripcionEl = document.getElementById("modal-descripcion");
  const ulIng = document.getElementById("modal-ingredientes");
  const tecnicaEl = document.getElementById("modal-tecnica");
  const olPasos = document.getElementById("modal-pasos");
  const presentacionEl = document.getElementById("modal-presentacion");
  const maridajeEl = document.getElementById("modal-maridaje");
  const modal = document.getElementById("recetaModal");

  if (!tituloEl || !imagenEl || !descripcionEl || !ulIng || !tecnicaEl || !olPasos || !presentacionEl || !maridajeEl || !modal) {
    console.error("Elementos del modal faltantes en el DOM.");
    return;
  }

  tituloEl.textContent = r.titulo;
  imagenEl.src = `${imageBase}${r.slug}.${r.ext}`;
  imagenEl.alt = r.titulo;
  descripcionEl.textContent = r.descripcion;

  ulIng.innerHTML = r.ingredientes.map(i => `<li>${i}</li>`).join("");
  tecnicaEl.textContent = r.tecnica;
  olPasos.innerHTML = r.pasos.map(p => `<li>${p}</li>`).join("");
  presentacionEl.textContent = r.presentacion;
  maridajeEl.textContent = r.maridaje;

  // Mostrar modal (añadir la clase 'show' que definimos en CSS)
  modal.classList.add("show");

  // Forzar scroll to top del modal (útil si vienen varias recetas y el usuario scrolleó)
  modal.querySelector(".modal-content").scrollTop = 0;
}

function cerrarModal() {
  const modal = document.getElementById("recetaModal");
  if (!modal) return;
  modal.classList.remove("show");
}

// =====================
// WhatsApp Widget
// =====================


// =====================
// Init
// =====================
document.addEventListener("DOMContentLoaded", () => {
  renderRecetas();

  // Cerrar modal al click fuera del contenido
  const modal = document.getElementById("recetaModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target && e.target.id === "recetaModal") cerrarModal();
    });
  }
});
