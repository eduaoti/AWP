FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

# Copiamos el resto (para build/start) — en dev montamos /src como volumen
COPY . .

EXPOSE 3000

# Por defecto, el compose usará `npm run dev`
CMD ["npm", "run", "start"]
