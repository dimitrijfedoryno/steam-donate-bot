FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY admin/package.json admin/package-lock.json ./admin/
RUN cd admin && npm ci && npm run build

COPY src/ ./src/
COPY alert.html ./
COPY sounds/ ./sounds/
COPY scripts/ ./scripts/

RUN mkdir -p logs

EXPOSE 3000

CMD ["node", "src/gui.js"]
