FROM ghcr.io/puppeteer/puppeteer:21.11.0
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
