FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && npm run start:dev"]
