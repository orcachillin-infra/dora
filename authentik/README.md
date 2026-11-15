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

## Migration state

All providers are `confidential`, `per_provider` issuer, `sub_mode=hashed_user_id`, `include_claims_in_id_token`, with `default-provider-authorization-implicit-consent` (no consent screen, same as Kanidm) and scopes `openid`, `email`, `profile`. Every application is bound to the `users` group with `policy_engine_mode=any`.

The `groups` claim comes from the default `profile` scope mapping, which returns `request.user.groups.all()` names. Nothing extra was needed for the `authentik Admins` mapping in Forgejo.

| Application | Client ID | Redirect URI | Config location | State |
| --- | --- | --- | --- | --- |
| `tidarr` | `kKY9tynS2sCPosOrwjCeAXQwZFaJLRUVbsquZMeO` | `https://tidarr.orcachill.in/api/auth/oidc/callback` | `~/server/.env` on Shamu | migrated and working |
| `forgejo` | `forgejo` | `https://git.orcachill.in/user/oauth2/authentik/callback` | `login_source` table in `/var/lib/forgejo/forgejo.db` | wired, first login pending |
| `komodo` | `komodo` | `https://komodo.orcachill.in/auth/oidc/callback` | `/root/komodo/compose.env` + `/root/komodo/secrets/komodo-oidc-client-secret` | wired, first login pending |
| `netbird` | `netbird` | `https://network.orcachill.in/oauth2/callback` | `connector` table in `/var/lib/netbird/data/idp.db` | wired, first login pending |
| `jellyfin` | - | - | Jellyfin SSO plugin config on Shamu | not started |

Notes from the migration, in the order they bit:

- Forgejo's login source name is part of the redirect URI (`/user/oauth2/<name>/callback`). The source was renamed `kanidm` to `authentik`, so the provider redirect URI has to match exactly.
- Forgejo only requests `openid` by default. Without `--scopes openid --scopes email --scopes profile` an OIDC login has no email claim and the account cannot be created. The source cache also needs a container restart before the new scopes show up in the authorize URL.
- Komodo reads OIDC from env vars, but it is deployed from `/root/komodo`, not from this repo, and `docker compose` there needs `--env-file compose.env` or the `${...}` substitutions fail and nothing is recreated.
- NetBird federates through its own embedded IdP. The upstream connector row lives in `idp.db` (table `connector`, type `oidc`) and is written with the management server stopped. Local email and password login stays enabled as break-glass, and `extra_user_approval_required` is on, so a first login creates an identity that needs approving.
- The `authentik/media` directory is mounted but was owned by root while the server runs as `1000:1000`. It is chowned now; without that, media uploads fail.

## Cutover

1. Confirm all apps log in against `id.orcachill.in`. Jellyfin is still outstanding.
2. Repoint the apps one at a time and confirm login and group mapping, starting with the lowest-risk client.
3. Move the Caddy route: `id.orcachill.in` becomes `auth.orcachill.in` and the Kanidm site block goes away.
4. Update every provider and app to the `auth.orcachill.in` issuer.
5. Stop the Kanidm container. Keep `/var/lib/kanidm/db` for one backup cycle before deleting it.

Rollback is one line: keep the Kanidm Caddy route and point it back.

## Email

`AUTHENTIK_EMAIL__*` in `.env` submits through Stalwart on Orkid. This is what makes invitations and password resets work.

- host `mail.orcachill.in`, port `587`, `USE_TLS=true` (STARTTLS)
- the SMTP username must be the full address `authentik@orcachill.in`. Stalwart returns `535 5.7.8` for the bare account name `authentik`
- the mailbox was created over Stalwart's JMAP registry API (`x:Account/set`, then a second `set` for `credentials` because the password cannot be set at creation). Stalwart is the source of truth here, not a file in this repo
- submission is reached over NetBird. Orkid's `inet mail_staging` output chain allows the stalwart uid egress only to the relay ports, and the TLS certificate covers `mail.orcachill.in` rather than the NetBird IP, so `compose.yml` carries `extra_hosts: mail.orcachill.in:100.114.67.239` for `server` and `worker`. Without it the containers resolve the public address, where 587 is dropped
- verified by calling Django's `send_mail` inside the server container, which is the same code path the UI uses. There is no `ak` test-email command

## Stalwart notes from the migration

Four separate faults came out of this, all of them Stalwart-side rather than authentik-side:

- Stalwart downloads its web UI bundle from GitHub on every startup. That uid cannot reach GitHub, so the bundle was never installed and `/admin`, `/account` and `/ui` all returned 404 — only the OAuth `/login` page worked, and it complains about a missing `redirect_uri` when opened directly. Fixed with a temporary 443 allow for uid 995, then the rule was removed again; the bundle stays cached.
- The UI signs in as an OAuth client of Stalwart itself. `x:Application.oauthClientId` was null, which is the empty `<meta name="oauth-client-id">` in the served HTML. Client `webui` was created with `redirectUris` as a url-to-bool map (the undocumented part: a list or a nested object is rejected) and the application pointed at it. A restart is required before the meta tag picks it up.
- `STALWART_RECOVERY_MODE` disables the mail listeners entirely (25/465/587/993) and cannot complete the UI's OAuth flow (`Unknown resource indicator`). Use it for API work only, and treat it as mail downtime.
- Orkid has global IPv6 addresses but no IPv6 default route, so anything resolving AAAA-first fails to connect. `/etc/gai.conf` now carries `precedence ::ffff:0:0/96 100`.

## Enrollment / onboarding flow

`onboard` is an invitation-gated enrollment flow (`designation: enrollment`, `authentication: none`, title "Enroll your account"):

| order | stage | notes |
| --- | --- | --- |
| 10 | `enrollment-invitation` | requires a valid `itoken`, rejects the flow without one |
| 20 | `enrollment-prompt` | `username`, `email`, `password`, `name` prompt fields |
| 30 | `enrollment-write` | creates the user with `create_users_as: internal` and `create_users_group: users` |
| 40 | `enrollment-email-verification` | `email/account_confirmation.html`, `token_expiry: minutes=30`, uses global SMTP settings |
| 50 | `enrollment-login` | logs the new account in |

Two things that are easy to get wrong when rebuilding this:

- the password must be a **prompt field of type `password`**, not a Password stage. A Password stage authenticates an existing account, so in an enrollment flow it fails every backend and the plan ends on `ak-stage-access-denied` with `error_message: "Unknown error"`.
- the email stage has to come **after** the user-write stage. Before it there is no account for the confirmation token, which fails the same way.
- the `default-password-change-password-policy` is attached to the prompt stage's `validation_policies`, otherwise weak passwords are accepted silently.

Invite someone:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"alice","flow":"aa3fa7e6-0f5f-4057-9289-87f07b3c1a4e","single_use":true,"expires":null}' \
  https://id.orcachill.in/api/v3/stages/invitation/invitations/
```

then send them `https://id.orcachill.in/if/flow/onboard/?itoken=<invitation.pk>`. The same thing exists in the UI under Directory → Invitations.

Note that `users` is the group every application is bound to, so enrollment grants access to all of them at once. Someone who should only get one app needs a policy binding on the others.
