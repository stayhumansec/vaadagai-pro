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

## Automated backups (recommended)

The server can email itself a full Excel backup (all houses/records/EB
readings/rent history, one sheet each) every night, and on demand from the
Settings page. It's off by default — nothing breaks if you skip this — but
without it, your only copy of the data is the SQLite file on this one VM.

Using Gmail is the simplest free option:

1. Turn on [2-Step Verification](https://myaccount.google.com/security) on
   the Google account you want to send from (required for the next step).
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords),
   create an **App Password** (name it anything, e.g. "vaadagai-pro-backup").
   Copy the 16-character password shown — this is **not** your normal Google
   password, and it's shown only once.
3. Add to `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=your@gmail.com
   SMTP_PASS=the 16-character app password (no spaces)
   SMTP_FROM=your@gmail.com
   BACKUP_EMAIL_TO=your@gmail.com
   BACKUP_CRON=0 2 * * *
   ```
   `BACKUP_EMAIL_TO` can be a different address than `SMTP_USER` if you'd
   rather receive backups somewhere else. `BACKUP_CRON` is a standard cron
   expression in the server's local time (UTC in a fresh Ubuntu VM) —
   `0 2 * * *` is 2am daily.
4. Restart the containers so the new `.env` values are picked up:
   ```bash
   docker compose -f docker-compose.https.yml up -d --build
   ```
5. Log in to the app → **அமைவு (Settings)** → **"📧 இப்போது பேக்அப் அனுப்பு"**
   to send a test backup immediately, rather than waiting until 2am to find
   out whether it's wired up correctly.

Any other SMTP provider works the same way — just change `SMTP_HOST`/`SMTP_PORT`
and use that provider's credentials instead.

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
