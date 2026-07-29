# Static site — nothing to build, just serve the file.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html 404.html robots.txt /usr/share/nginx/html/

# Unprivileged port so this runs fine as a non-root user.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
