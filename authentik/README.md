# Dora Authentik

Authentik is being staged at `https://id.orcachill.in` as the replacement for Kanidm. It is not the live identity provider yet: Kanidm still owns `https://auth.orcachill.in` and every current OAuth2 client.

The listener is bound to `127.0.0.1:9000`. Caddy is the only public entry point, and the site block in `caddy/config/sites/id.orcachill.in.caddy` reuses the existing `*.orcachill.in` wildcard certificate.

## Components

- `postgresql` - dedicated Postgres 17, volume `authentik_postgres-data`, tuned for the 6 GB host (`shared_buffers=128MB`, `max_connections=60`). Runs as the image postgres uid (70) under `init: true`.
- `redis` - cache and task queue, persistence deliberately disabled.
- `server` - HTTP and API on `127.0.0.1:9000`.
- `worker` - background tasks.

Login was verified end to end against `/api/v3/flows/executor/default-authentication-flow/` after the bootstrap rebuild: identification, password stage, redirect, then `/api/v3/core/users/me/` returning `akadmin` as superuser with the `authentik Admins` group. Note the flow executor only accepts `application/json`, not form posts.

## Host quirk: no-new-privileges is off for this stack

Dora runs podman 5.7 / crun 1.21 / containers-common 0.66.0 behind the docker shim. The generated `containers-default-0.66.0` AppArmor profile denies signals from a container process to peers in the `&crun` child profile whenever `no-new-privileges` is set. It showed up two ways while bringing this stack up:

- The Postgres entrypoint hangs: `gosu` spins at 100% CPU inside Go's `setgid` all-threads syscall, because the `rtmin+1` thread signals are denied.
- The postmaster cannot signal its own children: `could not signal for checkpoint: Permission denied`, followed by a recovery loop that never finishes.

`infisical-db` runs the same image and also leaves the flag off. Root vs uid 70 and `init` on/off were bisected against a throwaway container; dropping `no-new-privileges` while keeping the default AppArmor profile was the only combination that reached `database system is ready to accept connections` and then shut down cleanly. Revisit when the host packages move.

## Secrets

`.env` holds `AUTHENTIK_SECRET_KEY` and `PG_PASS`. It is gitignored. The intended home is Infisical under `/authentik`, rendered by `infisical-agent` like the Caddy tokens, at which point the file can become a rendered path instead of a repo-local file.

## Bootstrap

`AUTHENTIK_BOOTSTRAP_PASSWORD` in `.env` drives the documented bootstrap: on first start the `system/bootstrap.yaml` blueprint creates `akadmin`, creates the `authentik Admins` group, puts `akadmin` in it, and sets the tenant's `setup` flag.

Do not set the admin password with `ak changepassword` instead. There is no `is_superuser` column on users in 2026.8 (it is RBAC), so an `akadmin` with a working password but no group membership can log in and do nothing, and the `setup` flag stays false, which makes `/` redirect to `/setup` while `/setup` 500s because the setup flow is no longer applicable once the admin has a usable password. The stack was rebuilt from an empty database once to get out of that state.

The current admin password is in `/root/authentik-akadmin-recovery.txt` on Dora. Move it into the password manager and delete the file, the same convention as the Kanidm recovery files. Changing the password in the UI leaves the env var stale; the blueprint only applies while `setup` is false.

`AUTHENTIK_BOOTSTRAP_EMAIL` is unset, so the admin email is the blueprint default `root@example.com`.

The default brand is `authentik-default` with the title `authentik`, which means "answer on whatever host the request arrives on". Rename it when the UI is branded for `auth.orcachill.in`.

Email is unconfigured, so invitations and password resets will not send until `AUTHENTIK_EMAIL__*` is filled in.

## Migration target

Kanidm clients currently in use:

| Client | Consuming app | Redirect URI |
| --- | --- | --- |
| `netbird` | NetBird 0.76.0 | `https://network.orcachill.in/oauth2/callback` |
| `komodo` | Komodo | `https://komodo.orcachill.in/auth/oidc/callback` |
| `forgejo` | Forgejo on Orkid | see `infra-orkid/forgejo` |
| `jellyfin` | Jellyfin on Shamu | Jellyfin SSO plugin callback |
| `tidarr` | Tidarr on Shamu | check app config |

Kanidm issues per-client issuers (`https://auth.orcachill.in/oauth2/openid/<client>`); Authentik issues per-application ones (`https://auth.orcachill.in/application/o/<slug>/`). The shapes are close, so each app change is a provider slug plus client id and secret.

## Cutover

1. Recreate all five providers in Authentik on `id.orcachill.in` and register each redirect URI against the staging host.
2. Repoint the apps one at a time and confirm login and group mapping, starting with the lowest-risk client.
3. Move the Caddy route: `id.orcachill.in` becomes `auth.orcachill.in` and the Kanidm site block goes away.
4. Update every provider and app to the `auth.orcachill.in` issuer.
5. Stop the Kanidm container. Keep `/var/lib/kanidm/db` for one backup cycle before deleting it.

Rollback is one line: keep the Kanidm Caddy route and point it back.
