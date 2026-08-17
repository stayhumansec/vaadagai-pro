# Deploying வாடகை Pro (free, with HTTPS)

Google OAuth requires HTTPS on any redirect URI that isn't `localhost`, so a
plain HTTP deployment on a bare IP won't let anyone log in. This guide covers
a genuinely free, long-running setup: a permanent free VM plus Caddy for
automatic HTTPS.

## 1. Get a free permanent VM

**Oracle Cloud Always Free** gives a real VM (up to 4 OCPU / 24GB RAM on the
Ampere/ARM shape) that never expires and is never billed unless you
explicitly upgrade.

1. Sign up at [oracle.com/cloud/free](https://www.oracle.com/cloud/free/) (a
   card is required for identity verification only).
2. **Compute → Instances → Create Instance.**
   - Image: Ubuntu 22.04+
   - Shape: "Change shape" → **Ampere (ARM)** → `VM.Standard.A1.Flex`, 2
     OCPU / 12GB is plenty. If that shape reports no capacity in your
     region, retry later or fall back to `VM.Standard.E2.1.Micro` (x86).
   - Add your SSH public key.
3. Once it's running, note the public IP.
4. Under the instance's **Subnet → Security Lists**, add ingress rules for
   TCP `80` and `443` from `0.0.0.0/0` (SSH/22 is open by default).

Any other VM with a public IP and open 80/443 works the same way — this is
the only Oracle-specific part.

## 2. Get a free hostname

A bare IP can't get a Let's Encrypt certificate. [sslip.io](https://sslip.io)
gives you a real, working hostname for free with no signup: for IP
`140.238.12.34`, your hostname is `140-238-12-34.sslip.io`. If you own a real
domain, point an A record at the IP instead and use that.

## 3. Install Docker on the VM

```bash
ssh ubuntu@<your-vm-ip>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
sudo apt install -y docker-compose-plugin
```

## 4. Configure Google OAuth for this host

Back in [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials),
add an authorized redirect URI for your real host:
```
https://<your-hostname>/auth/callback
```
(Keep the `localhost:5173` one too if you still develop locally.)

## 5. Clone and configure

```bash
git clone https://github.com/stayhumansec/vaadagai-pro.git
cd vaadagai-pro
cp .env.example .env
```

Edit `.env`:
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://<your-hostname>/auth/callback
JWT_SECRET=<openssl rand -hex 32>
```

```bash
cp Caddyfile.example Caddyfile
# edit Caddyfile: replace your-hostname.sslip.io with your real hostname
```

## 6. Run it

```bash
docker compose -f docker-compose.https.yml up -d --build
```

Caddy listens on 80/443, gets and renews a Let's Encrypt certificate for
your hostname automatically, and proxies everything to the app container
(which isn't exposed to the internet directly). Visit
`https://<your-hostname>` and sign in.

The SQLite database and uploaded proof documents live in the
`vaadagai-data` / `vaadagai-uploads` Docker volumes, so `docker compose
down` and `up` again (or a full server reboot) doesn't lose data. Only
`docker compose down -v` (which explicitly removes volumes) would.

## Updating later

```bash
git pull
docker compose -f docker-compose.https.yml up -d --build
```

## Auto-deploy on every push (optional)

`.github/workflows/ci.yml` includes a `deploy` job that runs the two commands
above automatically over SSH whenever CI passes on `main`. It needs three
repository secrets configured (below) — until they're added, this job fails
with an SSH connection error (visible as a red X on the Actions tab), it
does not silently skip. **Status: active** — the three secrets are
configured.

On GitHub: **repo → Settings → Secrets and variables → Actions → New
repository secret**, add:

| Secret name | Value |
|---|---|
| `DEPLOY_HOST` | Your server's IP, e.g. `129.225.135.31` |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_SSH_KEY` | The **full contents** of your private key file (the `.key`/`.pem` you downloaded when creating the VM), including the `-----BEGIN ... PRIVATE KEY-----` / `-----END...-----` lines |

The corresponding public key is already authorized on the server (it's the
same key pair you used to create the VM), so no server-side changes are
needed — just the three secrets above.

**Security note:** this gives GitHub Actions (and therefore anyone who can
push to `main` or trigger a workflow run) the ability to run arbitrary
commands on your server as the `ubuntu` user. That's a normal tradeoff for a
personal project with one contributor, but don't reuse this key for
anything you'd regret losing control of, and rotate it (delete the secret,
generate a new key pair, update the server's `~/.ssh/authorized_keys`) if
you ever suspect it's been exposed.
