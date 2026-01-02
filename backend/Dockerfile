# Use official Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies
# Copy package.json and package-lock.json first (for caching)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose the port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]