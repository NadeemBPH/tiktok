# Use the official Node.js image
FROM node:18-slim

# Install required system packages (headless deps for Chromium)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    xvfb \
    xauth \
    libnss3 \
    libxss1 \
    libasound2 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libxdamage1 \
    libxfixes3 \
    libxcomposite1 \
    libxi6 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Do NOT skip Chromium download; let Puppeteer manage the matching version
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
ENV NODE_ENV=production

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (Puppeteer will download Chromium here)
RUN npm install

# Copy app source
COPY . .

# Expose the app port
EXPOSE 4000

# Start the application with xvfb-run
CMD ["xvfb-run", "-a", "node", "server.js"]
