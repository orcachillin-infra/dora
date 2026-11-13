# Pelican forwarding

Dora is the public ingress for the Pelican nodes. The `orkid` node has a public address of its own, but the panel points users at the node names, which all resolve to dora.

## Wings API and console

`caddy/config/sites/pelican.caddy` publishes two hostnames on port 8095:

- `orkid.console.orcachill.in` → `orkid.network.orcachill.in:8095`
- `luna.console.orcachill.in` → `luna.network.orcachill.in:8095`

Both Wings instances run with TLS off (the panel nodes have `behind_proxy` set), so Caddy terminates TLS and browsers get a valid certificate for the console websocket. The panel talks to the same hostnames.

These names live under `console.orcachill.in`, which is a CNAME wildcard pointing at Dora. dora's usual `import desec` cannot be used for them, because the `_acme-challenge` TXT record under a CNAME wildcard is not in the desec zone. The certificates come from the default http-01 flow instead, so the site blocks carry no `tls` directive.

## Game ports

`pelican-forward.service` runs `forward.sh` once at boot. The script DNATs inbound traffic on dora's public address to the nodes over NetBird and masquerades it so return traffic comes back the same way.

Only the luna node needs this for game ports, because it has no public address:

- UDP and TCP 27000-27099: game allocations for the luna node

## SFTP

SFTP is plain SSH, so Caddy cannot route it by hostname the way it does the API. Each node gets its own forwarded port and the node's `daemon_sftp` has to match:

- TCP 2022 → `orkid` Wings SFTP (node `daemon_sftp` 2022)
- TCP 2023 → `luna` Wings SFTP (node `daemon_sftp` 2023)

The panel shows users `sftp://<user>.<server short uuid>@<node fqdn>:<daemon_sftp>`, so a mismatch here sends people to the wrong node's SSH server.

## The script

The script owns two iptables chains, `PELICAN-FWD` (DNAT) and `PELICAN-FWD-POST` (masquerade), and rebuilds them on every run, so it is safe to re-run. It also removes the older `PELICAN-LUNA` chains if they are still present. Widen `GAME_PORTS` and re-run the unit when a node needs more ports; also create the matching allocations in the panel.

Installed as a symlink, like the other host units in this repository:

```
ln -sf /etc/komodo/repos/infra-dora/pelican-forward/pelican-forward.service /etc/systemd/system/pelican-forward.service
systemctl daemon-reload
systemctl enable --now pelican-forward
```

## Allocations on luna

Wings binds game ports on the allocation's `ip`, so that address has to exist on the node. Luna's allocations use `0.0.0.0` with `ip_alias` set to Dora's public address: Wings then binds every interface, and the panel still shows users the Dora address to connect to. An allocation whose `ip` is Dora's address makes every server on luna fail at boot with `cannot assign requested address`.
