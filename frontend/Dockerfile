FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
RUN chown -R appuser:appgroup /usr/share/nginx/html /etc/nginx/templates
ENV PORT=8080
USER appuser
CMD sh -c "sed 's/__PORT__/'\"$PORT\"'/' /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
