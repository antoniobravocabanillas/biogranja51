// netlify/functions/tiktok.js
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

exports.handler = async function(event) {
  // ?user=biogranja51 o ?urls=url1|url2
  const params = event.queryStringParameters || {};
  const user = params.user;
  const urlsParam = params.urls; // opcional lista separada por '|'

  try {
    if (urlsParam) {
      const urls = urlsParam.split("|").map(decodeURIComponent);
      const results = await Promise.all(urls.map(async url => {
        const oembed = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
        if (oembed.ok) {
          const data = await oembed.json();
          return { url, thumbnail: data.thumbnail_url, author_name: data.author_name };
        } else {
          return { url, thumbnail: null };
        }
      }));
      return { statusCode: 200, body: JSON.stringify(results) };
    }

    if (user) {
      // Simple scraping: solicitar la página pública y buscar los primeros video links en initial state.
      const res = await fetch(`https://www.tiktok.com/@${user}`);
      if (!res.ok) {
        return { statusCode: 502, body: "No se pudo obtener la página de TikTok" };
      }
      const html = await res.text();

      // Buscar URLs de video en el HTML (heurístico)
      const videoUrls = Array.from(html.matchAll(/href="(\/@[^"]+\/video\/\d+)"/g))
        .map(m => `https://www.tiktok.com${m[1]}`)
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 8); // máximo 8

      // Obtener oEmbed para cada video
      const results = await Promise.all(videoUrls.map(async url => {
        try {
          const oembed = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
          if (oembed.ok) {
            const data = await oembed.json();
            return { url, thumbnail: data.thumbnail_url, author_name: data.author_name };
          }
        } catch (e) { /* ignore */ }
        return { url, thumbnail: null };
      }));

      return { statusCode: 200, body: JSON.stringify(results) };
    }

    return { statusCode: 400, body: "Falta parámetro: user o urls" };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Error interno" };
  }
};
