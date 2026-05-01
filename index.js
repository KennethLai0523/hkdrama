const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeVideoUrl(savedUrl) {
  try {
    const decoded = Buffer.from(savedUrl, "base64").toString("utf-8");

    const reversedBack = decoded.split("").reverse().join("");
    if (reversedBack.startsWith("http")) return reversedBack;

    if (decoded.startsWith("http")) return decoded;
  } catch (e) {}

  return savedUrl;
}

exports.sitemap = functions.https.onRequest(async (req, res) => {
  const db = admin.firestore();
  const siteUrl = "https://hkdrama.site";

  const snapshot = await db.collection("dramas").get();

  let urls = "";

  snapshot.forEach(doc => {
    const data = doc.data();
    const dramaId = doc.id;

    urls += `
    <url>
      <loc>${escapeXml(`${siteUrl}/drama.html?id=${dramaId}`)}</loc>
      <changefreq>weekly</changefreq>
      <priority>0.8</priority>
    </url>`;

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

exports.video = functions.https.onRequest(async (req, res) => {
  try {
    const dramaId = req.query.id;
    const epNumber = Number(req.query.ep);

    if (!dramaId || !epNumber) {
      return res.status(400).send("Missing id or ep");
    }

    const docSnap = await admin.firestore()
      .collection("dramas")
      .doc(dramaId)
      .get();

    if (!docSnap.exists) {
      return res.status(404).send("Drama not found");
    }

    const data = docSnap.data();

    const episode = (data.episodes || []).find(
      ep => Number(ep.number) === Number(epNumber)
    );

    if (!episode || !episode.videoUrl) {
      return res.status(404).send("Episode not found");
    }

    const realUrl = decodeVideoUrl(episode.videoUrl);

    return res.redirect(302, realUrl);

  } catch (error) {
    console.error(error);
    return res.status(500).send(error.message);
  }
});

exports.segment = functions.https.onRequest(async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).send("Missing segment URL");
    }

    const fetch = (await import("node-fetch")).default;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": url,
        "Origin": new URL(url).origin
      }
    });

    if (!response.ok) {
      return res.status(500).send(
        "Failed to fetch playlist. Status: " + response.status + " " + response.statusText
      );
    }

    const buffer = await response.arrayBuffer();

    res.set("Content-Type", "video/mp2t");
    res.set("Cache-Control", "no-store");

    return res.send(Buffer.from(buffer));

  } catch (error) {
    console.error(error);
    return res.status(500).send(error.message);
  }
});