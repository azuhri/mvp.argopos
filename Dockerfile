# Stage 1: Build app
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build


# Stage 2: Serve dengan Nginx
FROM nginx:alpine

# copy config nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# copy hasil build ke nginx
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]