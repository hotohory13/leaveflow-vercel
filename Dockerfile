FROM node:20-slim

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Install root dependencies
RUN npm ci --production

# Copy client package files and install
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

# Copy all source code
COPY . .

# Build the frontend
RUN cd client && npm run build

# Expose port
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]
