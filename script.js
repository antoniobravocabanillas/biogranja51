// Productos
const products = [
  { name: "Pollo tierno (30 días)", price: 25, img: "/img/productos/pollo/pollo-tierno.jpg", desc: "Pollo joven, ideal para un sabor suave y nutritivo." },
  { name: "Pollo clásico (45 días)", price: 28, img: "/img/productos/pollo/pollo-clasico.jpg", desc: "Sabor balanceado, ideal para toda la familia." },
  { name: "Pollo robusto (60 días)", price: 32, img: "/img/productos/pollo/pollo-robusto.jpg", desc: "Más carne y sabor intenso para cortes premium." },
  { name: "Pechuga", price: 15, img: "/img/productos/pollo/pechugas.jpg", desc: "Pechuga magra y saludable." },
  { name: "Pata Muslo", price: 12, img: "/img/productos/pollo/muslo.jpg", desc: "Muslo carnoso y sabroso." },
  { name: "Alitas", price: 10, img: "/img/productos/pollo/alitas.webp", desc: "Perfectas para aperitivos o BBQ." },
  { name: "Patas", price: 8, img: "/img/productos/pollo/patas.jpg", desc: "Para caldos y recetas tradicionales." },
  { name: "Cuy entero joven", price: 40, img: "/img/productos/cuy/cuy-entero-joven.png", desc: "Cuy fresco, nutritivo y tradicional." },
  { name: "Pulpa de cuy desmenuzada", price: 26, img: "/img/productos/cuy/pulpa_cuy.jpg", desc: "Ideal para guisos y recetas rápidas." },
  { name: "Hamburguesa de cuy", price: 20, img: "/img/productos/cuy/hamburguesa_cuy.jpg", desc: "Sabroso y saludable." },
  { name: "Compost orgánico", price: 15, img: "/img/productos/compost/compost.webp", desc: "Fertilizante natural 100% sostenible." }
];

let cart = [];
const itemsPerPage = 8;
let currentPage = 1;

// Render productos con paginación
function renderProducts() {
  const container = document.getElementById("products-container");
  container.innerHTML = "";
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginatedItems = products.slice(start, end);

  paginatedItems.forEach(p => {
    const card = document.createElement("div");
    card.classList.add("product-card");
    card.innerHTML = `
      <div class="card-front">
        <img src="${p.img}" alt="${p.name}">
        <h3>${p.name}</h3>
        <p>S/ ${p.price.toFixed(2)}</p>
      </div>
      <div class="card-back">
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
        <button onclick="addToCart('${p.name}', ${p.price})">Agregar al Carrito</button>
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

// Carrito
function addToCart(name, price) {
  let item = cart.find(p => p.name === name);
  if (item) item.quantity++;
  else cart.push({ name, price, quantity: 1 });
  updateCartCount();
}

function changeQuantity(name, delta) {
  let item = cart.find(p => p.name === name);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter(p => p.name !== name);
  renderCartItems();
  updateCartCount();
}

function updateCartCount() {
  document.getElementById("cart-count").textContent = cart.reduce((sum,i)=>sum+i.quantity,0);
}

// Overlay carrito
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
    total += item.price * item.quantity;
    const li = document.createElement("li");
    li.innerHTML = `
      ${item.name} - S/ ${item.price.toFixed(2)}
      <div class="qty-control">
        <button onclick="changeQuantity('${item.name}', -1)">–</button>
        <span>${item.quantity}</span>
        <button onclick="changeQuantity('${item.name}', 1)">+</button>
      </div>
    `;
    cartItems.appendChild(li);
  });
  cartTotal.textContent = `Total: S/ ${total.toFixed(2)}`;
}

// Checkout WhatsApp
document.getElementById("checkoutBtn").addEventListener("click", () => {
  if (!cart.length) { alert("Carrito vacío"); return; }
  let message = "Hola, quiero realizar el siguiente pedido:\n\n";
  cart.forEach(i => { message += `${i.quantity} x ${i.name} (S/ ${(i.price*i.quantity).toFixed(2)})\n`; });
  message += `\nTotal: S/ ${cart.reduce((sum,i)=>sum+i.price*i.quantity,0).toFixed(2)}`;
  window.open(`https://wa.me/51936198468?text=${encodeURIComponent(message)}`, "_blank");
});

renderProducts();
