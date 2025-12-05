---
sidebar_position: 4
---

# PostgreSQL Backups (Daily)

Reference approach for automated daily backups on Ubuntu.

## .pgpass for non-interactive auth

Format: `hostname:port:database:username:password`

Example (replace placeholders):

```bash
echo 'localhost:5432:*:<db_user>:<strong_password>' >> ~/.pgpass
chmod 600 ~/.pgpass
```

## Basic dump script idea

```bash
PGDATE=$(date +%F)
pg_dump -h localhost -U <db_user> -F c -f "/var/backups/pg/backup-$PGDATE.dump" <db_name>
```

Schedule with cron (e.g., daily at 2:30):

```bash
crontab -e
30 2 * * * /usr/local/bin/pg-backup.sh
```
