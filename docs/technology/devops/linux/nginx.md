---
sidebar_position: 1
---

# Nginx Setup (Reverse Proxy + Static)

## Install Nginx

```bash
sudo apt-get install nginx
```

## Base server config (placeholders)

Create a site file like `/etc/nginx/sites-available/example` and symlink to `sites-enabled`.
Replace placeholders like `<your_domain>`, `<api_upstream_host>`, `<api_upstream_port>`, and `<web_root>`.

```nginx
server {
    server_name <your_domain>;
    large_client_header_buffers 4 32k;
    client_max_body_size 10M;

    location /api/ {
        proxy_pass         http://<api_upstream_host>:<api_upstream_port>/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection $connection_upgrade;
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location / {
        root <web_root>;
        try_files $uri $uri/ /index.html;
    }

    location /app {
        alias <web_root>/web/;
        try_files $uri $uri/ /app/index.html;
    }

    # Deny access to .git directories
    location ~ /\.git {
        return 404;
    }

    listen 80;
}
```

### Optional: TLS server block (replace with your cert paths)

```nginx
server {
    server_name <your_domain>;

    # Redirect HTTP to HTTPS
    listen 80;
    return 301 https://$host$request_uri;
}

server {
    server_name <your_domain>;

    # Provide your own certificate and key paths
    listen 443 ssl;
    ssl_certificate     /etc/ssl/certs/<your_cert>.pem;
    ssl_certificate_key /etc/ssl/private/<your_key>.pem;

    # ... same locations as above ...
}
```

## Connection upgrade map (nginx.conf)

Add to `nginx.conf` (http context) to support WebSockets/HTTP upgrade:

```nginx
map $http_connection $connection_upgrade {
    "~*Upgrade" $http_connection;
    default keep-alive;
}
```

## Apply and test

```bash
sudo nginx -t
sudo systemctl reload nginx
```
