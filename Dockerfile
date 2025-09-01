# Use the official Node.js image
FROM node:18-slim

# Install required system packages
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    apt-transport-https \
    software-properties-common \
    xvfb \
    x11-xkb-utils \
    xfonts-100dpi \
    xfonts-75dpi \
    xfonts-scalable \
    xfonts-cyrillic \
    x11-apps \
    clang \
    libdbus-1-dev \
    libgtk2.0-0 \
    libnotify-dev \
    libgconf-2-4 \
    libnss3 \
    libxss1 \
    libasound2 \
    libxtst6 \
    xauth \
    xvfb \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Verify Chrome installation
RUN google-chrome --version

# Set Chrome as the default browser
RUN update-alternatives --install /usr/bin/x-www-browser x-www-browser /usr/bin/google-chrome-stable 200 \
    && update-alternatives --set x-www-browser /usr/bin/google-chrome-stable \
    && update-alternatives --install /usr/bin/gnome-www-browser gnome-www-browser /usr/bin/google-chrome-stable 200 \
    && update-alternatives --set gnome-www-browser /usr/bin/google-chrome-stable

# Create a non-root user
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV CHROME_PATH=/usr/bin/google-chrome-stable
ENV CHROME_BIN=/usr/bin/google-chrome-stable
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV DISPLAY=:99
ENV NO_SANDBOX=true
ENV NO_PROXY=*
ENV LANG="C.UTF-8"
ENV LC_ALL="C.UTF-8"

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app source
COPY . .

# Set proper permissions
RUN chown -R pptruser:pptruser /app

# Run as non-root user
USER pptruser

# Expose the app port
EXPOSE 3000

# Start the application with xvfb-run
CMD ["xvfb-run", "--server-args=\"-screen 0 1280x800x24 -ac -listen tcp -nolisten unix\"", "node", "server.js"]
