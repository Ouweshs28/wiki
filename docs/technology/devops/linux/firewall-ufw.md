---
sidebar_position: 3
---

# UFW Firewall Rules

Common allow rules (adjust to your needs):

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow out 465/tcp
```

If using IPv6, ensure UFW is configured for IPv6 in `/etc/default/ufw`.

Enable and check status:

```bash
sudo ufw enable
sudo ufw status verbose
```

Be careful not to lock yourself out of SSH on remote servers.
