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
  { name: "Pollo tierno (30 días)", price: 13, weight: 3, img: "/img/productos/pollo/pollo-tierno.jpg", desc: "Pollo joven, ideal para un sabor suave y nutritivo." },
  { name: "Pollo clásico (45 días)", price: 11, weight: 4, img: "/img/productos/pollo/pollo-clasico.jpg", desc: "Sabor balanceado, ideal para toda la familia." },
  { name: "Pollo robusto (60 días)", price: 10, weight: 5, img: "/img/productos/pollo/pollo-robusto.jpg", desc: "Más carne y sabor intenso para cortes premium." },
  { name: "Pechuga", price: 18.9, img: "/img/productos/pollo/pechugas.jpg", desc: "Pechuga magra y saludable." },
  { name: "Pata Muslo", price: 14.9, img: "/img/productos/pollo/muslo.jpg", desc: "Muslo carnoso y sabroso." },
  { name: "Alitas", price: 12.5, img: "/img/productos/pollo/alitas.webp", desc: "Perfectas para aperitivos o BBQ." },
  { name: "Patas", price: 6, img: "/img/productos/pollo/patas.jpg", desc: "Para caldos y recetas tradicionales." },
  { name: "Cuy entero joven", price: 40, img: "/img/productos/cuy/cuy-entero-joven.png", desc: "Cuy fresco, nutritivo y tradicional." },
  { name: "Pulpa de cuy desmenuzada", price: 26, img: "/img/productos/cuy/pulpa_cuy.jpg", desc: "Ideal para guisos y recetas rápidas." },
  { name: "Hamburguesa de cuy", price: 20, img: "/img/productos/cuy/hamburguesa_cuy.jpg", desc: "Sabroso y saludable." },
  { name: "Compost orgánico", price: 15, img: "/img/productos/compost/compost.webp", desc: "Fertilizante natural 100% sostenible." }
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

    const priceLabel = p.weight ? `S/ ${p.price.toFixed(2)} x Kg (≈ ${p.weight} Kg)` : `S/ ${p.price.toFixed(2)}`;

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-front">
          <img src="${p.img}" alt="${p.name}">
          <h3>${p.name}</h3>
          <p>${priceLabel}</p>
          <button  onclick="addToCart('${p.name}')">Agregar al Carrito</button>
        </div>
        <div class="card-back">
          <h3>${p.name}</h3>
          <p>${p.desc}</p>
          <button onclick="addToCart('${p.name}')">Agregar al Carrito</button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
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
    btn.addEventListener("click", () => { currentPage = i; renderProducts(); });
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
    cart.push({ ...product, quantity: 1 });
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
  document.getElementById("cart-count").textContent = cart.reduce((sum,i)=>sum+i.quantity,0);
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
  if (!cart.length) { alert("Carrito vacío"); return; }

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

  const total = cart.reduce((sum,i)=> 
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


// ==========================
// Inicializar
// ==========================
renderProducts();
updateCartCount();
