// /media/js/tiktok.js
// Versión que usa la Netlify Function /api/tiktok para obtener videos recientes

async function fetchLatestTikToks(user) {
  const res = await fetch(`/api/tiktok?user=${encodeURIComponent(user)}`);
  if (!res.ok) throw new Error("No se pudo obtener videos de TikTok");
  return await res.json(); // array { url, thumbnail, author_name }
}

// Convierte una URL de TikTok en embed URL
function tiktokEmbedSrc(url) {
  const match = url.match(/video\/(\d+)/);
  return match ? `https://www.tiktok.com/embed/v2/${match[1]}` : null;
}

// Construir tarjetas
async function initTikTokGallery(user) {
  const container = document.getElementById("tiktok-section");
  container.innerHTML = `<p style="color:#757575;">Cargando videos de @${user}...</p>`;

  try {
    const videos = await fetchLatestTikToks(user);
    if (!videos || videos.length === 0) {
      container.innerHTML = `<p>No se encontraron videos públicos en TikTok.</p>`;
      return;
    }

    container.innerHTML = "";
    videos.forEach((vid) => {
      const card = document.createElement("div");
      card.className = "tiktok-card";
      const thumb = vid.thumbnail || "/comprobantes/assets/logos/bg51.png";

      card.innerHTML = `
        <img src="${thumb}" class="tiktok-thumb" alt="TikTok preview" loading="lazy" />
        <div class="tiktok-meta">Ver video</div>
      `;
      container.appendChild(card);

      const embedSrc = tiktokEmbedSrc(vid.url);
      card.addEventListener("click", () => openTiktokModal(embedSrc));
    });
  } catch (err) {
    console.error("Error al cargar TikToks:", err);
    container.innerHTML = `<p>Error al obtener videos. Inténtalo más tarde.</p>`;
  }
}

// Modal
function openTiktokModal(embedSrc) {
  if (!embedSrc) {
    alert("No se puede reproducir este video.");
    return;
  }
  const modal = document.getElementById("tiktok-modal");
  const content = document.getElementById("modal-content");
  content.innerHTML = `
    <iframe
      src="${embedSrc}"
      style="width:100%;height:600px;border:0;"
      allow="autoplay; encrypted-media"
      allowfullscreen
    ></iframe>
  `;
  modal.classList.remove("hidden");
}

function closeTiktokModal() {
  const modal = document.getElementById("tiktok-modal");
  const content = document.getElementById("modal-content");
  content.innerHTML = "";
  modal.classList.add("hidden");
}

document.getElementById("modal-close").addEventListener("click", closeTiktokModal);
document.getElementById("modal-backdrop").addEventListener("click", closeTiktokModal);

// Inicializa con tu usuario TikTok
initTikTokGallery("biogranja51");
