# Use Puppeteer's official image with Chromium preinstalled
FROM ghcr.io/puppeteer/puppeteer:21.7.0

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Prepare writable data directory for SQLite
RUN mkdir -p /data && chmod 777 /data
ENV DB_FILE=/data/tiktok.db

# App dir
WORKDIR /app

# Only copy package files first for better layer caching
COPY package*.json ./

# Install deps
RUN npm ci --only=production || npm install --only=production

# Copy the rest of the app
COPY . .

# Expose the app port (matches server.js default)
EXPOSE 4000

# Start the app (Chromium is available in the base image; headless runs without Xvfb)
CMD ["node", "server.js"]
