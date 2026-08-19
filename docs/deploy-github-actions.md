# Deploy — GitHub Actions + Harbor (self-hosted runner)

On every push to `main`, a **self-hosted** GitHub Actions runner (running ON the
server, inside the VPN) builds a Docker image, pushes it to Harbor, and runs the
container. A self-hosted runner is required because Harbor and the server are
VPN-only — GitHub's cloud runners cannot reach them.

Workflow: [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)
Image: `harbor.hinagro.com/insurance/api-playground:latest`
Container: `api-playground`, port **5011 → 3000**

## How the public URL reaches this app (READ THIS — it's not obvious)

Public URL: `https://iadore-onboarding-poc.ins.perfios.com/demo/api-playground`

The whole demo site has **ONE public door: port 5009** (the `india-health-onboarding`
container). Cloudflare sends every `/demo/*` request there. **This app has no public
port** — `5011` is only for direct/debug access on the host. Instead, india-health
forwards `/demo/api-playground/*` to us internally, by container name, over the
`demo-net` Docker network:

```
Cloudflare (443) → 5009 india-health → rewrite → api-playground:3000/demo/api-playground/* → us
```

Two hard requirements, or you get a 404/502:
1. **This container MUST run on `--network demo-net`** (NOT `insurance_network`) so
   `http://api-playground:3000` resolves from india-health. The workflow does this.
2. **india-health's `next.config.mjs` must have the rewrite** for `/api-playground`
   + `/api-playground/:path*` → `http://api-playground:3000/demo/api-playground...`
   (already added there). This app is Next.js with `basePath: '/demo/api-playground'`,
   so the bare path works natively — no trailing-slash forward needed (unlike GFF's
   FastAPI mount).

Normal code changes here need NOTHING in india-health — just `git push` this repo.
Only touch india-health's rewrite if this app's **URL path, container name, or port**
changes. Same one-port model as `/demo/life` (GFF) and `/demo/facescan`.

## ⚠️ IMPORTANT: this app's runner is on a DIFFERENT server than the demo box

The GitHub Actions runner for THIS repo lives on a **different machine** than the demo
server (`172.17.4.99`, where india-health / port 5009 / `demo-net` run). So:

- `git push` **builds the image and pushes it to Harbor** — that part works.
- `git push` **does NOT deploy to the demo server.** The workflow's `docker run` step
  runs on the *other* host, which has no `demo-net` network (`docker: network demo-net
  not found`, exit 125). That is expected and harmless — ignore that failure.
- **To make a code change live, you must manually redeploy on the demo server** (Part
  "Manual redeploy" below). This is the real deploy step for this app.

If the runner is ever moved onto the demo box, the workflow would deploy automatically
and the manual step goes away — but as of 2026-08-19 it is NOT, so treat deploys as manual.

## The flow (what actually happens today)
```
push to main
  → runner on ANOTHER server:
      1. docker login harbor.hinagro.com   (HARBOR_USERNAME / HARBOR_PASSWORD)
      2. docker build -t harbor.hinagro.com/insurance/api-playground:latest .
      3. docker push                                   ✅ image now in Harbor
      4. docker run … --network demo-net …             ❌ fails: no demo-net on that host
  → THEN, manually on the demo server (172.17.4.99): pull + run (see below)
```

## Manual redeploy on the demo server (the real deploy)

VPN + SSH to `172.17.4.99`, then:
```bash
sudo docker login harbor.hinagro.com     # once per session if creds not cached
sudo docker pull harbor.hinagro.com/insurance/api-playground:latest
sudo docker rm -f api-playground
sudo docker run -d \
  --name api-playground \
  --restart unless-stopped \
  --network demo-net \
  -p 5011:3000 \
  --env-file /opt/api-playground/.env.production \
  harbor.hinagro.com/insurance/api-playground:latest

# verify
sudo docker ps --format '{{.Names}} {{.Status}}' | grep api-playground
curl -s -o /dev/null -w "%{http_code}\n" https://iadore-onboarding-poc.ins.perfios.com/demo/api-playground/docs/login   # expect 200
```

**Env file location on the demo server:** `/opt/api-playground/.env.production`
(7 keys: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `INTERNAL_ENV_API_KEY`,
`KARZA_KEY`, `KARZA_BASE_URL`, `NEXT_PUBLIC_APP_URL`). `chmod 600`. Not in git.

**Normal behaviour, not a bug:** bare `/demo/api-playground` → 307 → `/docs/environmental`
→ 307 → `/docs/login` (protected routes redirect unauthenticated users to login). The
`/demo/api-playground` prefix is added automatically by Next.js `basePath`. Landing on the
login page = working.

## One-time setup

### 1. GitHub repo secrets  ✅ (you've added these)
Repo → **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `HARBOR_USERNAME` | your Harbor username |
| `HARBOR_PASSWORD` | your Harbor password |

No SSH secrets needed — the runner is on the server already.

### 2. Register + start the self-hosted runner  ⬅ THE STEP THAT UN-QUEUES JOBS
On the server, get the exact download URL + token from:
**Repo → Settings → Actions → Runners → New self-hosted runner → Linux.**
Then run (token is single-use and expires in ~1 hour):

```bash
# on the server (172.17.4.105), as a user that can run docker
mkdir -p ~/actions-runner && cd ~/actions-runner

# download (use the exact version URL GitHub shows you)
curl -o actions-runner-linux-x64.tar.gz -L \
  https://github.com/actions/runner/releases/download/vX.X.X/actions-runner-linux-x64-X.X.X.tar.gz
tar xzf actions-runner-linux-x64.tar.gz

# configure against THIS repo (paste the token from the GitHub page)
./config.sh --url https://github.com/Suj1234/insuranceAPI --token <RUNNER_TOKEN>

# install + start as a service (survives reboots)
sudo ./svc.sh install
sudo ./svc.sh start
# quick test instead of service:  ./run.sh
```

Verify: **Settings → Actions → Runners** shows a runner with a green **Idle** dot.
The moment it's online, the queued job runs automatically — no re-push needed.

**The runner user must be able to run docker:**
```bash
sudo usermod -aG docker $USER   # then log out/in (or restart the runner)
```

### 3. Harbor login on the server (one-time)
So `docker push`/`pull` work under the runner user:
```bash
docker login harbor.hinagro.com   # enter Harbor username + password
```

### 4. Server env file
Create `/opt/api-playground/.env.production` (not in the repo). Minimum:
```
INTERNAL_ENV_API_KEY=...
DATABASE_URL=...
KARZA_KEY=...                              # Karza/TKYC PAN key
KARZA_BASE_URL=https://testapi.karza.in    # optional; test by default
NEXT_PUBLIC_APP_URL=https://iadore-api-pg-poc.ins.perfios.com
```
`docker run` loads this via `--env-file`. Editing it takes effect on the next
deploy (or `docker rm -f api-playground` + re-run).

## Trigger
- Push to `main`, or **Actions → Build & Deploy → Run workflow**.

## Useful commands (on the server)
```bash
docker ps                                  # is it running?
docker logs -f api-playground              # live logs
docker logs --tail 50 api-playground       # recent logs
docker restart api-playground              # restart without rebuild
```

## Notes
- Container listens on 3000 (`HOSTNAME=0.0.0.0`), published as 5011.
- App uses `basePath: /api` → routes are served under `/api/*`
  (e.g. `/api/api/verify/pan`).
- No Redis. If a shared docker network is needed to reach other services, add
  `--network <name>` to the run step.

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| Job stuck **Queued** | no runner online for this repo | finish step 2; check Settings → Actions → Runners |
| `unauthorized` on Harbor | runner user not logged in | step 3 on the server |
| `permission denied` docker | runner user not in `docker` group | `usermod -aG docker`, restart runner |
| `port is already allocated` | old container holds 5011 | `docker ps`; the workflow already force-removes it |
| endpoint returns `VENDOR_NOT_CONFIGURED` | `KARZA_KEY` missing | add to `.env.production`, redeploy |
