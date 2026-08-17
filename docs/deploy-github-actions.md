# Deploy — GitHub Actions + Harbor (Docker)

Mirrors the `india-health-platform` deploy model. On every push to `main`, a
**self-hosted** GitHub Actions runner (running ON the server) builds a Docker
image, pushes it to Harbor, and runs the container.

Workflow: [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)
Image: `harbor.hinagro.com/insurance/api-playground:latest`
Container: `api-playground`, port **5011 → 3000**

## The flow
```
push to main
  → self-hosted runner on 172.17.4.105 (no SSH needed — runs on the box)
      1. docker login harbor.hinagro.com   (HARBOR_USERNAME / HARBOR_PASSWORD)
      2. docker build -t api-playground:latest .
      3. tag → harbor.hinagro.com/insurance/api-playground:latest
      4. docker push
      5. docker rm -f api-playground (and anything holding port 5011)
      6. docker run -d -p 5011:3000 --env-file /opt/api-playground/.env.production
```

## One-time setup (you must do these — I can't)

### 1. GitHub repo secrets
Repo → **Settings → Secrets and variables → Actions**. Add:

| Secret | Value |
|---|---|
| `HARBOR_USERNAME` | your Harbor username |
| `HARBOR_PASSWORD` | your Harbor password |

**No SSH key / host / port secrets** — the runner is on the server already.

### 2. Self-hosted runner (VERIFY — status unknown)
The workflow uses `runs-on: self-hosted`. The runner that `india-health-platform`
uses is on the same server; this repo must be allowed to use a self-hosted runner.
Check: Repo → **Settings → Actions → Runners**. If none is listed for this repo:
- reuse the org/existing runner (add this repo to its scope), or
- register a new runner: **Settings → Actions → Runners → New self-hosted runner**
  and run the shown commands on 172.17.4.105.

The runner's user must be able to run `docker` (in the `docker` group).

### 3. Server env file
Create `/opt/api-playground/.env.production` on the server (not in the repo).
Must include:
```
INTERNAL_ENV_API_KEY=...
DATABASE_URL=...
KARZA_KEY=...                              # Karza/TKYC PAN key
KARZA_BASE_URL=https://testapi.karza.in    # optional; test by default
NEXT_PUBLIC_APP_URL=https://iadore-api-pg-poc.ins.perfios.com
```
`docker run` reads this via `--env-file`; changing it takes effect on the next
deploy (or `docker rm -f api-playground` + re-run).

## Notes
- The container listens on 3000 internally (`HOSTNAME=0.0.0.0`), published as 5011.
- App uses `basePath: /api`, so routes are served under `/api/*`.
- No Redis (unlike the reference). If a shared docker network is required to reach
  other services, add `--network <name>` to the run step (reference uses `demo-net`).

## Trigger manually
Repo → **Actions → Build & Deploy → Run workflow** (also runs on push to main).

## Rollback
Revert the commit on `main` and push (rebuilds/redeploys the previous state), or on
the server: `docker rm -f api-playground && docker run -d ... <previous image tag>`.
Tag images per-release if you want easy rollback targets (currently `:latest` only).
