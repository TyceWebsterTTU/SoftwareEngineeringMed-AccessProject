FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Your app listens on port 3000
EXPOSE 3000

# Run the app
CMD [ "node", "database.js" ]