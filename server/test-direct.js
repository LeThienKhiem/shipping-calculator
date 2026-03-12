// server/test-direct.js
// Test SeaRates API directly with Node.js https (no Puppeteer).
// Run: node server/test-direct.js

const https = require("https");

const PLATFORM_ID = "40275";
const API_KEY = "K-81E37B04-2D41-4779-B8C9-570CEB576903";
const TOKEN_URL = `https://www.searates.com/auth/platform-token?id=${PLATFORM_ID}&api_key=${API_KEY}`;
const GRAPHQL_URL = "https://rates.searates.com/graphql";

function getToken() {
  return new Promise((resolve, reject) => {
    const url = new URL(TOKEN_URL);
    const opts = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: "GET",
      headers: { Accept: "application/json" },
    };
    const req = https.request(opts, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        console.log("=== GET Token response ===");
        console.log("Status:", res.statusCode);
        console.log("Headers:", JSON.stringify(res.headers, null, 2));
        console.log("Body:", body);
        console.log("");
        try {
          const json = JSON.parse(body);
          const token = json["s-token"] || json.token || json.access_token;
          if (token) resolve(token);
          else reject(new Error("No token in response: " + body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function postGraphQL(token) {
  const query = `query {
    rates(
      shippingType: FCL
      pointIdFrom: "P_19845"
      pointIdTo: "P_15786"
      container: ST20
      date: "2026-03-12"
    ) {
      general { totalPrice totalCurrency }
    }
  }`;
  const body = JSON.stringify({ query });

  return new Promise((resolve, reject) => {
    const url = new URL(GRAPHQL_URL);
    const opts = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        console.log("=== POST GraphQL response ===");
        console.log("Status:", res.statusCode);
        console.log("Headers:", JSON.stringify(res.headers, null, 2));
        console.log("Body:", data);
        resolve(data);
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  try {
    const token = await getToken();
    console.log("Token obtained, length:", token.length);
    await postGraphQL(token);
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}

main();
