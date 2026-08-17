FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

ENV PORT=3000
ENV DB_PATH=/app/data/vaadagai.db
ENV UPLOAD_PATH=/app/uploads/

EXPOSE 3000
CMD ["node", "server/index.js"]
