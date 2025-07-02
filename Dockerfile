# Use official Node.js LTS image
FROM node:18

# Create app directory
WORKDIR /app

# Copy your files into the container
COPY . .

# Install dependencies (only Express in your case)
RUN npm install express

# Expose the port your server listens on
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
