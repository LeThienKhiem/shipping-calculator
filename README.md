# SeaRates Logistics Explorer

A full-stack app to compare shipping rates and transit times using the SeaRates API. The backend is an Express server that obtains auth tokens and forwards GraphQL requests to SeaRates via direct HTTPS; the frontend is a React (Vite) UI for selecting ports and viewing rate results.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Run the app**

   ```bash
   npm run dev
   ```

   This starts both the API server and the Vite dev server.

## Environment

- **Node.js** is required (recommended LTS).
- **Backend (API):** port **3001** (or `PORT` env on Vercel) — Express server.
- **Frontend:** port **5173** — Vite dev server; proxies `/api` to the backend.

## API

The backend exposes a small proxy in front of SeaRates:

- **GET `/token`** — Returns a truncated platform token (for health checks).
- **GET `/rates`** — Proxies a rates GraphQL query. Query params: `shippingType`, `pointIdFrom`, `pointIdTo`, `container` (for FCL), `date`, optional `weight`.
- **POST `/graphql`** — Forwards a raw GraphQL query to SeaRates (body: `{ "query": "..." }`).

Rates are fetched from **SeaRates GraphQL** (`rates.searates.com`). The app uses a trial API key; the key expires **12.03.2026**.

## License

Private / internal use.
