// ==========================

document.addEventListener("DOMContentLoaded", () => {
  const burger = document.querySelector(".burger"); // botón del menú
  const nav = document.querySelector(".nav-links"); // contenedor del menú
  const navLinks = document.querySelectorAll(".nav-links a"); // todos los links

  // Toggle para abrir/cerrar
  burger.addEventListener("click", () => {
    nav.classList.toggle("active");
  });

  // Al hacer click en un link -> cierra el menú
  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("active");
    });
  });
});
// Productos con peso opcional
// ==========================
const products = [
  {
    name: "Pollo tierno (30 días)",
    subName: "Natural, nutritivo y lleno de sabor.",
    price: 13,
    weight: 3,
    img: "/img/productos/pollo/pollo-tierno.jpg",
    benefits0: "💧 Agua purificada → carne más limpia y segura",
    benefits1: "🌱 Sin hormonas ni químicos",
    benefits2: "🍲 Suave y jugoso, ideal para caldos y guisos",
    benefits3: "💪 Alto en proteína magra",
    desc: "Pollo joven, ideal para un sabor suave y nutritivo."
  },
  {
    name: "Pollo clásico (45 días)",
    subName: "Sabor balanceado para toda la familia.",
    price: 11,
    weight: 4,
    img: "/img/productos/pollo/pollo-clasico.jpg",
    benefits0: "👨‍👩‍👧 Ideal para preparaciones familiares",
    benefits1: "🍗 Carne equilibrada: jugosa pero firme",
    benefits2: "🌱 Criado de manera natural sin químicos",
    benefits3: "💪 Buena fuente de proteínas y vitaminas del grupo B",
    desc: "Sabor balanceado, ideal para toda la familia."
  },
  {
    name: "Pollo robusto (60 días)",
    subName: "Más carne, más sabor.",
    price: 10,
    weight: 5,
    img: "/img/productos/pollo/pollo-robusto.jpg",
    benefits0: "🍖 Mayor rendimiento en cortes grandes",
    benefits1: "🔥 Ideal para parrillas, hornos y recetas gourmet",
    benefits2: "💪 Alto contenido proteico con textura firme",
    benefits3: "🌱 Criado naturalmente, sin aceleradores de crecimiento",
    desc: "Más carne y sabor intenso para cortes premium."
  },
  {
    name: "Pechuga",
    subName: "Ligera, nutritiva y versátil.",
    price: 18.9,
    img: "/img/productos/pollo/pechugas.jpg",
    benefits0: "💪 Baja en grasa, rica en proteína magra",
    benefits1: "🥗 Ideal para dietas fitness y saludables",
    benefits2: "🍳 Versátil: salteados, a la plancha o ensaladas",
    benefits3: "🌱 Libre de químicos y hormonas",
    desc: "Pechuga magra y saludable."
  },
  {
    name: "Pata Muslo",
    subName: "Jugoso y lleno de sabor.",
    price: 14.9,
    img: "/img/productos/pollo/muslo.jpg",
    benefits0: "🍗 Carne más jugosa y sabrosa",
    benefits1: "🔥 Perfecto para guisos, horno o parrilla",
    benefits2: "💪 Aporta proteínas, hierro y zinc",
    benefits3: "🌱 Criado naturalmente sin hormonas",
    desc: "Muslo carnoso y sabroso."
  },
  {
    name: "Alitas",
    subName: "Para compartir y disfrutar.",
    price: 12.5,
    img: "/img/productos/pollo/alitas.webp",
    benefits0: "🔥 Ideales para BBQ, frituras y snacks",
    benefits1: "🍺 Perfecto acompañamiento en reuniones",
    benefits2: "🍗 Carne tierna con piel crujiente",
    benefits3: "🌱 Criadas sin químicos, sabor auténtico",
    desc: "Perfectas para aperitivos o BBQ."
  },
  {
    name: "Patas",
    subName: "Tradición en tu mesa.",
    price: 6,
    img: "/img/productos/pollo/patas.jpg",
    benefits0: "🍲 Ricas en colágeno natural",
    benefits1: "🦴 Fortalece articulaciones y huesos",
    benefits2: "🌿 Usadas en caldos medicinales y tradicionales",
    benefits3: "🌱 100% naturales y frescas",
    desc: "Para caldos y recetas tradicionales."
  },
  {
    name: "Cuy entero joven",
    subName: "Nutrición ancestral en tu mesa.",
    price: 40,
    img: "/img/productos/cuy/cuy-entero-joven.png",
    benefits0: "💪 Rico en proteínas de alta calidad",
    benefits1: "❤️ Bajo en grasa y colesterol",
    benefits2: "🌿 Carne recomendada en dietas médicas tradicionales",
    benefits3: "🥘 Ideal para recetas típicas andinas",
    desc: "Cuy fresco, nutritivo y tradicional."
  },
  {
    name: "Pulpa de cuy desmenuzada",
    subName: "Practicidad y nutrición.",
    price: 26,
    img: "/img/productos/cuy/pulpa_cuy.jpg",
    benefits0: "⚡ Lista para usar en guisos y pastas",
    benefits1: "💪 Rica en proteínas y baja en grasa",
    benefits2: "🥘 Ideal para cocina rápida y saludable",
    benefits3: "🌱 Natural y sin aditivos",
    desc: "Ideal para guisos y recetas rápidas."
  },
  {
    name: "Hamburguesa de cuy",
    subName: "Innovación con tradición.",
    price: 20,
    img: "/img/productos/cuy/hamburguesa_cuy.jpg",
    benefits0: "🍔 Alternativa saludable a la hamburguesa convencional",
    benefits1: "💪 Aporta proteínas y aminoácidos esenciales",
    benefits2: "🌱 Menos grasa y colesterol",
    benefits3: "🔥 Listas para preparar y disfrutar",
    desc: "Sabroso y saludable."
  },
  {
    name: "Compost orgánico",
    subName: "De la granja a tu tierra.",
    price: 15,
    img: "/img/productos/compost/compost.webp",
    benefits0: "🌱 100% natural y sostenible",
    benefits1: "🌿 Enriquece el suelo con nutrientes esenciales",
    benefits2: "♻️ Reutiliza los subproductos de la granja",
    benefits3: "🌍 Contribuye a un ciclo agrícola responsable",
    desc: "Fertilizante natural 100% sostenible."
  }
];


let cart = JSON.parse(localStorage.getItem("cart")) || [];
const itemsPerPage = 8;
let currentPage = 1;

// ==========================
// Notificaciones
// ==========================
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ==========================
// Render productos
// ==========================
function renderProducts() {
  const container = document.getElementById("products-container");
  container.innerHTML = "";
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginatedItems = products.slice(start, end);

  paginatedItems.forEach(p => {
    const card = document.createElement("div");
    card.classList.add("product-card");

    const priceLabel = p.weight
      ? `S/ ${p.price.toFixed(2)} x Kg (≈ ${p.weight} Kg)`
      : `S/ ${p.price.toFixed(2)}`;

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-front">
          <img src="${p.img}" alt="${p.name}">
          <h4>${p.name}</h4>
          <p><strong>${p.subName}</strong></p><br>
          <p>${priceLabel}</p>
        </div>
        <div class="card-back">
          <h3>${p.name}</h3>
          <p>${p.desc}</p>
          <ul style="text-align: left; padding-left: 20px; list-style-type: none;">
            <li>${p.benefits0}</li>
            <li>${p.benefits1}</li>
            <li>${p.benefits2}</li>
            <li>${p.benefits3}</li>
          </ul>
          <button onclick="addToCart('${p.name}')">Agregar al Carrito</button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  // 👉 aquí activamos los eventos de flip SOLO en móvil
  if (window.innerWidth <= 768) {
    const cards = document.querySelectorAll(".product-card");

    cards.forEach(card => {
      card.addEventListener("click", () => {
        cards.forEach(c => {
          if (c !== card) c.classList.remove("flipped");
        });
        card.classList.toggle("flipped");
      });

      let startX = 0;
      card.addEventListener("touchstart", e => {
        startX = e.touches[0].clientX;
      });
      card.addEventListener("touchend", e => {
        const endX = e.changedTouches[0].clientX;
        if (Math.abs(startX - endX) > 50) {
          card.classList.remove("flipped");
        }
      });
    });
  }

  renderPagination();
}


function renderPagination() {
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";
  const totalPages = Math.ceil(products.length / itemsPerPage);
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    if (i === currentPage) btn.style.opacity = 0.6;
    btn.addEventListener("click", () => {
      currentPage = i;
      renderProducts();
    });
    pagination.appendChild(btn);
  }
}

// ==========================
// Carrito
// ==========================
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function addToCart(name) {
  const product = products.find(p => p.name === name);
  if (!product) return;

  let item = cart.find(p => p.name === name);
  if (item) {
    item.quantity++;
    showToast(`+1 ${name} agregado al carrito 🛒`);
  } else {
    cart.push({
      ...product,
      quantity: 1
    });
    showToast(`${name} agregado al carrito 🛒`);
  }
  updateCartCount();
  saveCart();
}

function changeQuantity(name, delta) {
  let item = cart.find(p => p.name === name);
  if (!item) return;
  item.quantity += delta;

  if (delta > 0) showToast(`+1 ${name} agregado 🛒`);
  else showToast(`-1 ${name} eliminado ❌`, "error");

  if (item.quantity <= 0) {
    cart = cart.filter(p => p.name !== name);
    showToast(`${name} eliminado del carrito ❌`, "error");
  }

  renderCartItems();
  updateCartCount();
  saveCart();
}

function updateCartCount() {
  document.getElementById("cart-count").textContent = cart.reduce((sum, i) => sum + i.quantity, 0);
}

// ==========================
// Overlay carrito
// ==========================
function openCart() {
  renderCartItems();
  document.getElementById("cartOverlay").style.display = "flex";
}

function closeCart() {
  document.getElementById("cartOverlay").style.display = "none";
}

function renderCartItems() {
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");
  cartItems.innerHTML = "";
  let total = 0;

  cart.forEach(item => {
    const unitTotal = item.weight ? item.price * item.weight : item.price;
    const subtotal = unitTotal * item.quantity;
    total += subtotal;

    let detail = "";
    if (item.weight) {
      const totalKg = item.weight * item.quantity;
      detail = `
        <strong>${item.quantity} x ${item.name}</strong><br>
        Peso total ≈ ${totalKg} Kg<br>
        Precio: S/ ${item.price.toFixed(2)} x Kg<br>
        Subtotal: S/ ${subtotal.toFixed(2)}
      `;
    } else {
      detail = `
        <strong>${item.quantity} x ${item.name}</strong><br>
        Precio unitario: S/ ${item.price.toFixed(2)}<br>
        Subtotal: S/ ${subtotal.toFixed(2)}
      `;
    }

    const li = document.createElement("li");
    li.innerHTML = `
      <div>${detail}</div>
      <div class="qty-control">
        <button onclick="changeQuantity('${item.name}', -1)">–</button>
        <span>${item.quantity}</span>
        <button onclick="changeQuantity('${item.name}', 1)">+</button>
      </div>
    `;
    cartItems.appendChild(li);
  });

  cartTotal.textContent = `Total: S/ ${total.toFixed(2)} (precio aproximado)`;
}

// ==========================
// Checkout WhatsApp
// ==========================
document.getElementById("checkoutBtn").addEventListener("click", () => {
  if (!cart.length) {
    alert("Carrito vacío");
    return;
  }

  let message = "📋 *Detalle de Pedido:*\n\n";

  cart.forEach(i => {
    const unitTotal = i.weight ? i.price * i.weight : i.price;
    const subtotal = unitTotal * i.quantity;

    if (i.weight) {
      const totalKg = i.weight * i.quantity;
      message += `• ${i.quantity} x ${i.name}\n`;
      message += `  Peso total: ≈ ${totalKg} Kg\n`;
      message += `  Precio: S/ ${i.price.toFixed(2)} x Kg\n`;
      message += `  Subtotal: S/ ${subtotal.toFixed(2)}\n\n`;
    } else {
      message += `• ${i.quantity} x ${i.name}\n`;
      message += `  Precio unitario: S/ ${i.price.toFixed(2)}\n`;
      message += `  Subtotal: S/ ${subtotal.toFixed(2)}\n\n`;
    }
  });

  const total = cart.reduce((sum, i) =>
    sum + (i.weight ? i.price * i.weight : i.price) * i.quantity, 0);

  message += `===========================\n`;
  message += `💰 *Total a pagar:* S/ ${total.toFixed(2)} (precio aproximado)\n\n`;

  message += `📝 *Datos del cliente:*\n`;
  message += `- Nombre completo: __________________\n`;
  message += `- Método de pago (Efectivo / Transferencia / Yape / Plin): __________________\n`;
  message += `- ¿Direccion de entrega si es con delivery?: __________________\n`;
  message += `- ¿Requiere Factura o Boleta?: __________________\n`;

  // limpiar carrito después de enviar
  localStorage.removeItem("cart");
  cart = [];
  updateCartCount();
  renderCartItems();

  window.open(`https://wa.me/51936198468?text=${encodeURIComponent(message)}`, "_blank");
});



// =========================CARD FLIPPED MOVIL

// Inicializar
// ==========================
renderProducts();
updateCartCount();