# Use the official Node.js image
FROM node:18-slim

# Install latest Chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: This installs the necessary libs to make the browser work with Puppeteer.
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Chromium and its dependencies
RUN apt-get update \
    && apt-get install -y chromium \
    && rm -rf /var/lib/apt/lists/*

# Create a symbolic link for Chromium
RUN ln -s /usr/bin/chromium /usr/bin/chromium-browser \
    && ln -s /usr/bin/chromium /usr/bin/google-chrome \
    && ln -s /usr/bin/chromium /usr/bin/google-chrome-stable

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_PATH=/usr/bin/chromium
ENV CHROME_BIN=/usr/bin/chromium
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app source
COPY . .

# Expose the app port
EXPOSE 4000

# Start the application
CMD ["node", "server.js"]
