# Pelican forwarding

Dora is the public ingress for the Pelican `luna` node, which sits on the home LAN behind `lily` and has no public IPv4.

## Wings API and console

`caddy/config/sites/pelican.caddy` publishes two hostnames on port 8095:

- `orkid.console.orcachill.in` → `orkid.network.orcachill.in:8095`
- `luna.console.orcachill.in` → `luna.network.orcachill.in:8095`

Both Wings instances run with TLS off (the panel nodes have `behind_proxy` set), so Caddy terminates TLS and browsers get a valid certificate for the console websocket. The panel talks to the same hostnames.

These names live under `console.orcachill.in`, which is a CNAME wildcard pointing at Dora. dora's usual `import desec` cannot be used for them, because the `_acme-challenge` TXT record under a CNAME wildcard is not in the desec zone. The certificates come from the default http-01 flow instead, so the site blocks carry no `tls` directive.

## Game ports and SFTP

`pelican-luna-forward.service` runs `luna-forward.sh` once at boot. The script DNATs inbound traffic on dora's public address to luna over NetBird and masquerades it so return traffic comes back the same way:

- UDP and TCP 27000-27099: game allocations for the luna node
- TCP 2022: Wings SFTP for luna, since users reach it on the node hostname that resolves to dora

The script owns two iptables chains, `PELICAN-LUNA` (DNAT) and `PELICAN-LUNA-POST` (masquerade), and rebuilds them on each run, so it is safe to re-run. Widen the range in `GAME_PORTS` and re-run the unit when a node needs more ports; also create the matching allocations in the panel.

Installed as a symlink, like the other host units in this repository:

```
ln -sf /etc/komodo/repos/infra-dora/pelican-forward/pelican-luna-forward.service /etc/systemd/system/pelican-luna-forward.service
systemctl daemon-reload
systemctl enable --now pelican-luna-forward
```

The `orkid` node needs none of this: it has a public address, so its game ports and SFTP are bound directly.

## Allocations on luna

Wings binds game ports on the allocation's `ip`, so that address has to exist on the node. Luna's allocations use `0.0.0.0` with `ip_alias` set to Dora's public address: Wings then binds every interface, and the panel still shows users the Dora address to connect to. An allocation whose `ip` is Dora's address makes every server on luna fail at boot with `cannot assign requested address`.
