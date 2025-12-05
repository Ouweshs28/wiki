---
sidebar_position: 3
---

# Run ASP.NET Core as a systemd Service (Kestrel)

Create a unit file at `/etc/systemd/system/kestrel-app.service`:

```ini
[Unit]
Description=ASP.NET Core Web App running on Ubuntu

[Service]
WorkingDirectory=/var/www/app
ExecStart=/usr/bin/dotnet /var/www/app/DeployingToLinuxWithNginx.dll
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=dotnet-web-app
User=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable kestrel-app.service
sudo systemctl start kestrel-app.service
sudo systemctl status kestrel-app.service
```

Logs:

```bash
journalctl -u kestrel-app.service -f
```
