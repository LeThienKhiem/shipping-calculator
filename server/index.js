// server/index.js
// SeaRates API proxy: Express + Puppeteer Stealth (for Railway).
// Requires: npm install express puppeteer-extra puppeteer-extra-plugin-stealth

const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const PORT = process.env.PORT || 3001;
const PLATFORM_ID = "40275";
const API_KEY = "K-81E37B04-2D41-4779-B8C9-570CEB576903";

let pageWWW, pageRates, cachedToken;

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (origin === "http://localhost:5173") return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true;
  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed) {
    const list = allowed.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.includes(origin)) return true;
  }
  return false;
}

async function waitForPage(page, name) {
  let attempts = 0;
  while (attempts < 10) {
    try {
      await page.evaluate(() => document.readyState);
      return;
    } catch (e) {
      console.error(`[${name}] not ready, waiting...`);
      await new Promise((r) => setTimeout(r, 1000));
      attempts++;
    }
  }
  throw new Error(`${name} never became ready`);
}

async function bfWWW(url, opts = {}) {
  await waitForPage(pageWWW, "pageWWW");
  return pageWWW.evaluate(async (url, opts) => {
    try {
      const r = await fetch(url, { credentials: "include", ...opts });
      return { status: r.status, body: await r.text() };
    } catch (e) {
      return { status: 0, body: e.message };
    }
  }, url, opts);
}

async function bfRates(url, opts = {}) {
  await waitForPage(pageRates, "pageRates");
  return pageRates.evaluate(async (url, opts) => {
    try {
      const r = await fetch(url, { credentials: "include", ...opts });
      return { status: r.status, body: await r.text() };
    } catch (e) {
      return { status: 0, body: e.message };
    }
  }, url, opts);
}

async function getToken() {
  if (cachedToken) return cachedToken;
  const url = `https://www.searates.com/auth/platform-token?id=${PLATFORM_ID}&api_key=${API_KEY}`;
  const { status, body } = await bfWWW(url, { headers: { Accept: "application/json" } });
  const json = JSON.parse(body);
  cachedToken = json["s-token"] || json.token || json.access_token;
  if (!cachedToken) throw new Error("No token found: " + body);
  return cachedToken;
}

async function gql(query) {
  const token = await getToken();
  const { status, body } = await bfRates("https://rates.searates.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });
  return { status, body };
}

async function init(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
      });

      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

      pageWWW = await browser.newPage();
      await pageWWW.setUserAgent(ua);
      await pageWWW.setViewport({ width: 1366, height: 768 });
      await pageWWW.goto("https://www.searates.com", {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await pageWWW.goto("https://www.searates.com/logistics-explorer", {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await new Promise((r) => setTimeout(r, 5000));

      await getToken();

      pageRates = await browser.newPage();
      await pageRates.setUserAgent(ua);
      await pageRates.setViewport({ width: 1366, height: 768 });
      await pageRates.goto("https://rates.searates.com", {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await new Promise((r) => setTimeout(r, 5000));

      console.log("✅ SeaRates proxy ready on port", PORT);
      return;
    } catch (e) {
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 5000));
      else throw new Error("Failed to init after 3 attempts");
    }
  }
}

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/token", async (req, res) => {
  try {
    const t = await getToken();
    res.json({ ok: true, token: t.slice(0, 60) + "..." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

async function autocomplete(q) {
  const query = (q || "").trim();
  if (!query) return [];
  const token = await getToken();
  const url = `https://www.searates.com/search/google-autocomplete?q=${encodeURIComponent(query)}`;
  const { status, body } = await bfWWW(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  if (status !== 200) throw new Error(`Autocomplete ${status}: ${body?.slice(0, 200)}`);
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error("Invalid autocomplete JSON");
  }
  const list = Array.isArray(data) ? data : data?.data ?? data?.results ?? [];
  return list.map((item) => ({
    name: item.city ?? item.name ?? item.description ?? "",
    country: item.country ?? "",
    place_id: item.place_id ?? item.placeId ?? "",
  }));
}

async function geocode(placeId) {
  const id = (placeId || "").trim();
  if (!id) throw new Error("Missing place_id");
  const token = await getToken();
  const url = `https://www.searates.com/search/google-geocode?place_id=${encodeURIComponent(id)}`;
  const { status, body } = await bfWWW(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  if (status !== 200) throw new Error(`Geocode ${status}: ${body?.slice(0, 200)}`);
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error("Invalid geocode JSON");
  }
  return { ports: data.country_ports ?? [], city_port: data.city_port ?? null };
}

app.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const cities = await autocomplete(q);
    let ports = [];
    if (cities.length > 0 && cities[0].place_id) {
      try {
        const geo = await geocode(cities[0].place_id);
        const list = geo.ports ?? [];
        ports = (Array.isArray(list) ? list : []).map((p) => ({
          id: p.id ?? "",
          name: p.name ?? "",
          unlocode: p.unlocode ?? "",
          country_code: p.country_code ?? p.country ?? "",
        }));
        if (geo.city_port && geo.city_port.id) {
          const cp = geo.city_port;
          if (!ports.some((x) => x.id === cp.id)) {
            ports.unshift({
              id: cp.id,
              name: cp.name ?? "",
              unlocode: cp.unlocode ?? "",
              country_code: cp.country_code ?? cp.country ?? "",
            });
          }
        }
      } catch (_) {}
    }
    res.json({ cities, ports });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/geocode", async (req, res) => {
  try {
    const placeId = req.query.place_id;
    const { ports: rawPorts, city_port } = await geocode(placeId);
    const ports = (Array.isArray(rawPorts) ? rawPorts : []).map((p) => ({
      id: p.id ?? "",
      name: p.name ?? "",
      unlocode: p.unlocode ?? "",
      country_code: p.country_code ?? p.country ?? "",
    }));
    if (city_port && city_port.id && !ports.some((p) => p.id === city_port.id)) {
      ports.unshift({
        id: city_port.id,
        name: city_port.name ?? "",
        unlocode: city_port.unlocode ?? "",
        country_code: city_port.country_code ?? city_port.country ?? "",
      });
    }
    res.json({ ports, city_port: city_port || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/rates", async (req, res) => {
  try {
    const { shippingType = "FCL", pointIdFrom, pointIdTo, container = "ST20", date, weight } = req.query;
    if (!pointIdFrom || !pointIdTo) return res.status(400).json({ error: "Missing pointIdFrom or pointIdTo" });

    const dateStr = date || new Date().toISOString().slice(0, 10);
    const isFCL = ["FCL", "LAND_FCL", "RAIL_FCL"].includes(shippingType);

    const query = `query {
      rates(
        shippingType: ${shippingType}
        pointIdFrom: "${pointIdFrom}"
        pointIdTo: "${pointIdTo}"
        ${isFCL ? `container: ${container}` : ""}
        ${weight ? `weight: ${weight}` : ""}
        date: "${dateStr}"
      ) {
        general {
          shipmentId totalPrice totalCurrency
          validityFrom validityTo totalTransitTime
          expired spot indicative spaceGuarantee
        }
        points {
          location { name country code pointType }
          provider shippingType
          routeTotal pointTotal totalPrice totalCurrency
          transitTime { rate port route }
          routeTariff { name abbr price currency }
          pointTariff { name abbr price currency }
        }
      }
    }`;

    const { status, body } = await gql(query);
    res.status(status || 200).send(body);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/graphql", async (req, res) => {
  try {
    const { query } = req.body;
    const { status, body } = await gql(query);
    res.status(status || 200).send(body);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

init()
  .then(() => {
    app.listen(PORT);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
