# Installation Guide

**www.doc** is distributed as pre-built Docker images hosted on the GitHub Container Registry. You do not need to clone the full repository or compile any assets to run it in production. 

## Prerequisites
- A Linux server, VM, or NAS.
- **Docker** and **Docker Compose v2** installed.

---

## 1. Download the deployment files

Create a directory for your application and download the production compose file and the example environment file:

```bash
mkdir www.doc && cd www.doc
curl -O https://raw.githubusercontent.com/pixelito/www.doc/master/docker-compose.prod.yml
curl -o .env https://raw.githubusercontent.com/pixelito/www.doc/master/.env.example
```

## 2. Configure your Environment

Open the `.env` file in your preferred text editor. You only need to configure a few essential variables to get the app running securely.

| Variable | Description |
|----------|-------------|
| `APP_URL` | The exact address users will type in their browser to access the app (e.g., `https://docs.example.com` or `http://192.168.1.50:8080`). This is crucial for generating correct links in emails and PDF exports. |
| `DB_PASSWORD` | Set this to a strong, secure password for the internal PostgreSQL database. You won't need to type this password anywhere else. |
| `APP_KEY` | *(Optional but recommended)* This is a 32-byte Base64-encoded string (starting with `base64:`). <br>• **Linux/Mac:** Run `openssl rand -base64 32`<br>• **Windows (PowerShell):** Run `[Convert]::ToBase64String((1..32|%{[byte](Get-Random -Max 256)}))` <br><br>**Note:** If you don't want to deal with the command line, simply **leave this blank!** The app will automatically generate a secure key on its first boot and save it securely in the Docker volume. Setting it manually just ensures you have a visible backup of the key in your `.env` file. |

*(Note: You do not need to configure email settings (`MAIL_*`) in the `.env` file. Email configuration is handled safely via the Web Setup Wizard after the app boots.)*

## 3. Choose your Network/TLS Strategy

Depending on where you are hosting the app, you have a few ways to expose it:

### Option A: Standard HTTP (Reverse Proxy)
If you are exposing the app to the public internet, you should put your own TLS-terminating reverse proxy (like Nginx, Caddy, or Traefik) in front of the application. 
Simply run the app, and it will bind to port `8080` locally:

```bash
docker compose -f docker-compose.prod.yml up -d
```
You can view a sample Caddy configuration for a reverse proxy in [`Caddyfile.example`](../Caddyfile.example).

### Option B: Internal Network with Self-Signed TLS
If you are running the app internally (e.g., on a local IP like `192.168.10.10` or a local `.local` hostname) and don't have a reverse proxy, you can use our built-in TLS compose file. This spins up the entire stack along with a lightweight Caddy container that automatically generates a secure, self-signed certificate for your specific IP or hostname.

1. Ensure your `APP_URL` starts with `https://` (e.g., `https://192.168.10.10`).
2. Download the standalone TLS compose file:
   ```bash
   curl -O https://raw.githubusercontent.com/pixelito/www.doc/master/docker-compose.tls.yml
   ```
3. Start the stack using only this file:
   ```bash
   docker compose -f docker-compose.tls.yml up -d
   ```
*(Note: Because the certificate is self-signed, your browser will display a security warning the first time you visit. You can safely bypass this warning for your internal network.)*

## 4. Run the Web Setup Wizard

Once the containers are running, the app automatically handles all database migrations and cache building in the background. 

Open your `APP_URL` in a web browser. You will be greeted by the **Setup Wizard**, which will walk you through:
1. Creating the initial Admin account.
2. Setting your workspace/instance name.
3. Configuring SMTP settings for outgoing emails.

Once finished, your documentation app is fully functional and ready to use!

---

## Updating to a new version

To pull the latest updates and restart the app, simply run:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```
*(If you are using the internal TLS option, replace `docker-compose.prod.yml` with `docker-compose.tls.yml` in the commands above).*

Database schema migrations are run automatically when the new containers boot, ensuring your app stays perfectly up-to-date with zero manual database intervention.

---

## Deploying via GUI Managers (Komodo, Portainer, Dockge)

If you use a container GUI manager:
- You can create a stack by pointing directly to the Git repository.
- Alternatively, you can copy and paste the contents of `docker-compose.prod.yml` directly into the UI.
- Add your `.env` variables (like `APP_URL` and `DB_PASSWORD`) in the environment variables section of your manager.

If you are pasting raw text and want the **Internal TLS** option (Option B), simply copy and paste the entire contents of `docker-compose.tls.yml` into your manager instead of the standard compose file. It has everything you need pre-configured.
