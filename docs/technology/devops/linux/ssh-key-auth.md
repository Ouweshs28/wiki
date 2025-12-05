---
sidebar_position: 5
---

# SSH Key-Based Authentication

Configure SSH key auth on a Linux server.

## Steps

1. Generate a key on your local machine:
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```
2. Copy the public key to the server:
   ```bash
   ssh-copy-id <user>@<server>
   # or manually append the public key to ~/.ssh/authorized_keys
   ```
3. Secure permissions:
   ```bash
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/authorized_keys
   ```
4. Optional: disable password authentication in `/etc/ssh/sshd_config`:
   ```
   PasswordAuthentication no
   ChallengeResponseAuthentication no
   UsePAM yes
   ```
   Then reload:
   ```bash
   sudo systemctl reload ssh
   ```
