FROM node:22-slim

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN mkdir -p data

EXPOSE 20128
ENV PORT=20128
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s \
  CMD curl -f http://localhost:20128/api/status || exit 1

CMD ["node", "src/index.js"]
