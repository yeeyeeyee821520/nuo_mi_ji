# Dockerfile for the persist service

FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
EXPOSE 4001
ENV NODE_ENV=production
CMD ["node", "server.js"]
