# Start with a lightweight Node.js image
FROM node:18-alpine

# Create a folder inside the container
WORKDIR /app

# Copy package files first (better for caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your code
COPY . .

# Open the port your app runs on (e.g., 3000)
EXPOSE 3000

# The command to start the app
CMD ["node", "server.js"]