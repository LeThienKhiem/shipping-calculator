// server/index.js
// SeaRates API proxy using Express + native https (no Puppeteer).
// Run: node server/index.js

const https = require("https");
const express = require("express");

const PORT = process.env.PORT || 3001;
const PLATFORM_ID = "40275";
const API_KEY = "K-81E37B04-2D41-4779-B8C9-570CEB576903";
const TOKEN_URL = `https://www.searates.com/auth/platform-token?id=${PLATFORM_ID}&api_key=${API_KEY}`;
const GRAPHQL_HOST = "rates.searates.com";

let cachedToken = null;

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: "GET",
      headers: { Accept: "application/json" },
    };
    const req = https.request(opts, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

function httpsPost(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body, "utf8");
    const opts = {
      hostname,
      port: 443,
      path: path || "/",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Content-Length": buf.length,
        ...headers,
      },
    };
    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(buf);
    req.end();
  });
}

async function getToken() {
  if (cachedToken) return cachedToken;
  const { status, body } = await httpsGet(TOKEN_URL);
  if (status !== 200) throw new Error(`Token request failed: ${status} ${body}`);
  const json = JSON.parse(body);
  cachedToken = json["s-token"] || json.token || json.access_token;
  if (!cachedToken) throw new Error("No token in response: " + body);
  return cachedToken;
}

async function gql(query) {
  const token = await getToken();
  return httpsPost(GRAPHQL_HOST, "/graphql", JSON.stringify({ query }), {
    Authorization: `Bearer ${token}`,
  });
}

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
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

app.listen(PORT, () => {
  console.log("✅ SeaRates proxy ready on port", PORT);
});
