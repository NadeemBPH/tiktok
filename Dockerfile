# Use Node.js LTS
FROM node:18-bullseye-slim

# Install required system dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-khmeros \
    fonts-kacst \
    ttf-freefont \
    --no-install-recommends

# Set environment variables
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium
ENV CHROME_BIN=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# App directory
WORKDIR /app

# Create writable data directory for SQLite
RUN mkdir -p /app/data
ENV DB_FILE=/app/data/tiktok.db

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --no-optional

# Copy application code
COPY . .

# Expose the application port
EXPOSE 4000

# Set non-root user for security
RUN chown -R node:node /app
USER node

# Start the application
CMD ["node", "server.js"]
