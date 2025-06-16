# Use a lightweight Node.js base image
FROM node:20-slim

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to leverage Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the agent's source code and dependencies into the container
# IMPORTANT: The wallet.json must exist in the /agent directory before building!
COPY agent.js .
COPY wallet.json .
COPY lib/ ./lib/

# Expose no ports (this agent only makes outbound connections)

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Agent health check passed')" || exit 1

# Command to run the agent when the container starts
CMD ["node", "agent.js"]
