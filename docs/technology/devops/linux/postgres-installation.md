---
sidebar_position: 2
---

# Postgres Installation (Ubuntu)

Install and initialize PostgreSQL on Ubuntu.

## Install packages

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

Start the service (should be auto-started after install):

```bash
sudo systemctl start postgresql.service
sudo systemctl status postgresql.service
```

## Create a database user (interactive)

Switch to the `postgres` admin account and create a user:

```bash
sudo -i -u postgres
createuser --interactive
```

Follow the prompts to set name/role flags.

## Create a database

```bash
createdb <db_name>
```

If creating for a specific user:

```bash
createdb -O <db_user> <db_name>
```

## Change user password

Open `psql` as the `postgres` superuser and change a user's password:

```bash
sudo -u postgres psql
\password <db_user>
```

Use strong, unique passwords.
