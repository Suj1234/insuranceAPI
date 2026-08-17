# Deploy — GitHub Actions → SSH server

Replaces the old GitLab pipeline. On every push to `main`, GitHub Actions SSHes
into the server, pulls, builds, and restarts the app.

Workflow: [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)

## One-time setup (you must do these — I can't)

### 1. Add GitHub repo secrets
GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.
Add these four (same values the old GitLab pipeline used):

| Secret | Value | Notes |
|---|---|---|
| `SSH_PRIVATE_KEY` | the private key (full PEM, incl. header/footer lines) | Its **public** half must be in the deploy user's `~/.ssh/authorized_keys` on the server |
| `DEPLOY_HOST` | e.g. `172.17.4.105` | server IP/host |
| `DEPLOY_PORT` | e.g. `22` | SSH port |
| `DEPLOY_USER` | the SSH user | must be able to `sudo systemctl restart api-playground` |

### 2. Point the server's git checkout at GitHub
The deploy runs `git pull origin main` **on the server**. The server's repo
currently pulls from GitLab, so repoint it once:

```bash
ssh <user>@<server> -p <port>
cd /opt/api-playground/app
git remote set-url origin git@github.com:Suj1234/insuranceAPI.git
# make sure the server can auth to GitHub (deploy key or PAT):
git pull origin main   # confirm it works before relying on CI
```

If the server uses SSH to reach GitHub, add its key as a **deploy key** on the
GitHub repo (Settings → Deploy keys), read access is enough.

### 3. Server env vars (unchanged)
The app reads secrets from its systemd EnvironmentFile, not the repo. Ensure
these exist on the server (add `KARZA_KEY` for the new PAN endpoint):

```
INTERNAL_ENV_API_KEY=...
DATABASE_URL=...
KARZA_KEY=...                       # Karza/TKYC PAN key
KARZA_BASE_URL=https://testapi.karza.in   # optional; test by default
```

Restart the service after changing env: `sudo systemctl restart api-playground`.

## How it runs
- Push to `main` → the **Deploy to server** workflow runs automatically.
- Or trigger manually: repo → **Actions → Deploy to server → Run workflow**.
- `concurrency` ensures two deploys never overlap.

## Rollback
Revert the commit on `main` and push — the workflow redeploys the previous state.
Or SSH in and `git checkout <good-sha> && npm ci && npm run build && ... && sudo
systemctl restart api-playground`.
