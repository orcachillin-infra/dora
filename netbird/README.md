# Dora NetBird

This is a fresh staged NetBird control plane at `network.orcachill.in`. It does not contain or replace Amber's existing `ntw.gart.sh` control-plane state. Existing peers must be re-enrolled deliberately.

## Services

- NetBird combined server `0.76.0`: management, signal, relay, embedded identity provider, and STUN.
- NetBird Dashboard `2.90.9`.
- Caddy terminates public HTTPS and proxies HTTP, WebSocket, and h2c gRPC traffic.
- UDP `3478` is published directly for STUN.
- Backend HTTP ports `8081` and `8082` are loopback-only; health port `9000` remains internal to the server container.
- Account domain: `orcachill.in`; peer DNS suffix: `network.orcachill.in`.

## Data

- Runtime data: `/var/lib/netbird/data`
- Protected runtime configuration: `/var/lib/netbird/config.yaml`
- Bootstrap credentials: `/root/netbird-bootstrap/`

The runtime configuration contains relay and database encryption secrets and must never be committed. Back up the full data directory and protected configuration off-host.

## Authentication

The initial local owner is a break-glass account used to configure Kanidm as a generic OIDC provider. Keep local authentication enabled until Kanidm login is tested successfully.

Kanidm issuer: `https://auth.orcachill.in/oauth2/openid/netbird`

Kanidm redirect URI: `https://network.orcachill.in/oauth2/callback`

The connector-specific callback shown by some NetBird documentation is not used by the combined server in `0.76.0`. Verify the emitted redirect URI after upgrades before changing Kanidm's strict allowlist.

## Migration Boundary

Do not repoint `ntw.gart.sh` or stop Amber's NetBird services as part of this deployment. Move clients individually to `https://network.orcachill.in` and recreate required routes, DNS settings, groups, and policies before retiring the old control plane.
