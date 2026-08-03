# Dora Kanidm

Kanidm serves the fresh `auth.orcachill.in` identity domain. Its HTTPS listener is restricted to `127.0.0.1:7070`; Caddy is the only public entry point.

The container runs as the dedicated host/container identity `kanidm` (`982:982`).

## TLS

Kanidm uses a dedicated private backend certificate stored under `/var/lib/kanidm/pki`. Caddy trusts only its public CA certificate at `/etc/caddy/pki/kanidm-backend-ca.pem` and independently manages the public certificate for `auth.orcachill.in` with DeSEC DNS validation.

The private CA key and leaf key are host-only files and must never be committed. Record the leaf certificate expiry and rotate it before expiry by replacing `chain.pem` and `key.pem`, validating the pair, and sending `SIGHUP` to Kanidm.

## Persistent Data

- Database: `/var/lib/kanidm/db`
- Online backups: `/var/lib/kanidm/backups`
- Private PKI: `/var/lib/kanidm/pki`

Online backups run daily at `02:17` UTC and retain 14 versions. These local backups still require off-host replication.

## NetBird OIDC

The confidential `netbird` OAuth2 client permits members of `netbird_users` to request `openid`, `profile`, `email`, and `groups_name`. PKCE `S256`, ES256 signing, and strict redirect validation are enabled.

- Issuer: `https://auth.orcachill.in/oauth2/openid/netbird`
- Redirect URI: `https://network.orcachill.in/oauth2/callback`
- Landing URL: `https://network.orcachill.in/`

NetBird `0.76.0` uses the callback without a connector ID in the path. Confirm the callback emitted by NetBird before changing this strict redirect allowlist during an upgrade.

## Komodo OIDC

The confidential `komodo` OAuth2 client permits members of `komodo_users` to request `openid`, `profile`, `email`, and `groups_name`. PKCE `S256`, ES256 signing, and strict redirect validation are enabled.

- Issuer: `https://auth.orcachill.in/oauth2/openid/komodo`
- Redirect URI: `https://komodo.orcachill.in/auth/oidc/callback`
- Landing URL: `https://komodo.orcachill.in/`

Komodo local authentication remains enabled for break-glass access. New OIDC users are disabled by default and require explicit Komodo approval.

## Bootstrap

The initial break-glass recovery output is stored temporarily in root-only files on Dora:

- `/root/kanidm-admin-recovery.txt`
- `/root/kanidm-idm-admin-recovery.txt`

Transfer both generated passwords to the password manager and delete these files. Future recovery can be performed interactively with:

```bash
docker exec -it kanidm kanidmd recover-account admin
docker exec -it kanidm kanidmd recover-account idm_admin
```

Create a named administrative account for routine use; do not use the break-glass accounts day to day.
