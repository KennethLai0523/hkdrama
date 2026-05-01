const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// 🔒 Fix XML special characters (VERY IMPORTANT)
function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

exports.sitemap = functions.https.onRequest(async (req, res) => {
  const db = admin.firestore();
  const siteUrl = "https://hkdrama.site";

  const snapshot = await db.collection("dramas").get();

  let urls = "";

  snapshot.forEach(doc => {
    const data = doc.data();
    const dramaId = doc.id;

    // ✅ Drama page
    urls += `
    <url>
      <loc>${escapeXml(`${siteUrl}/drama.html?id=${dramaId}`)}</loc>
      <changefreq>weekly</changefreq>
      <priority>0.8</priority>
    </url>`;

    // ✅ Episode pages
    const episodes = data.episodes || [];

    episodes.forEach(ep => {
      urls += `
      <url>
        <loc>${escapeXml(`${siteUrl}/watch.html?id=${dramaId}&ep=${ep.number}`)}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
      </url>`;
    });
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>${siteUrl}</loc>
      <changefreq>daily</changefreq>
      <priority>1.0</priority>
    </url>
    ${urls}
  </urlset>`;

  res.set("Content-Type", "application/xml");
  res.status(200).send(xml);
});