# Use official Node.js image
FROM node:20-slim

# Set working directory in the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all other source code
COPY . .

# Expose the default Vue dev server port
EXPOSE 8080

# Run the development server
CMD ["npm", "run", "serve"]
