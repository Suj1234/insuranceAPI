# Deploy — GitHub Actions + Harbor (self-hosted runner)

On every push to `main`, a **self-hosted** GitHub Actions runner (running ON the
server, inside the VPN) builds a Docker image, pushes it to Harbor, and runs the
container. A self-hosted runner is required because Harbor and the server are
VPN-only — GitHub's cloud runners cannot reach them.

Workflow: [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)
Image: `harbor.hinagro.com/insurance/api-playground:latest`
Container: `api-playground`, port **5011 → 3000**

## The flow
```
push to main
  → self-hosted runner on the server (no SSH — runs on the box)
      1. docker login harbor.hinagro.com   (HARBOR_USERNAME / HARBOR_PASSWORD)
      2. docker build -t harbor.hinagro.com/insurance/api-playground:latest .
      3. docker push
      4. docker rm -f api-playground (and anything holding port 5011)
      5. docker run -d -p 5011:3000 --env-file /opt/api-playground/.env.production
```

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
