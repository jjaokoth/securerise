FROM node:18-slim AS build

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:18-slim AS runtime

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma
COPY --from=build /usr/src/app/.env.example ./

EXPOSE 8080

CMD ["node", "dist/index.js"]
