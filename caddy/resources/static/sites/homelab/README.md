# homelab

service index for the lab. static page, no build step, no framework.

black background, monospace, no borders, no rounded corners, all lowercase —
matches `caddy/resources/static/styles.css`.

## how it works

the page is static, so the status has to come from a file rather than a backend:

```
services.json   the catalog (hand edited, this is the source of truth)
probe.py        http-checks every service + scrapes node_exporter per host
status.json     what the page renders, written by probe.py, gitignored
```

`probe.py` runs on dora from `systemd/homelab-probe.timer` every 60s. it writes
`status.json` into this directory, which caddy already serves at
`static.orcachill.in/sites/homelab` (and at `homelab.orcachill.in` via
`caddy/config/sites/homelab.orcachill.in.caddy`).

the page polls `status.json` every 30s, so the freshest it can look is about a
minute behind. `/` focuses the filter box.

## probe states

- `up` — got a 2xx/3xx
- `odd` — server answered but the root path 404/401/403s, which is normal for
  apps that only serve a real path (s3, tiles, plex)
- `degraded` — 5xx
- `down` — nothing answered within 5s
- `lan` — entry with no url, `url: null`, so it renders as text only

## stats

per host, straight from `node_exporter` at
`<host>.network.orcachill.in:9100`: load1, cores, memory used, biggest disk,
uptime. cpu percent would need two samples, so load-per-core is used instead.

right now only `dora`, `orkid` and `shamu` run an exporter, the other hosts show
an error. `node-exporter/compose.yml` at the repo root is the one to copy
around.

## running it by hand

```sh
python3 probe.py --verbose            # one pass, writes ./status.json
python3 probe.py --loop 60            # stay running
python3 probe.py --catalog services.json --out /tmp/status.json
```

needs nothing but python 3 and netbird names resolving.

## deploy

```sh
sudo cp systemd/homelab-probe.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now homelab-probe.timer
```

caddy picks up `homelab.orcachill.in` on its own next reload. `status.json` is
gitignored, so if komodo ever does a clean checkout the first probe run has to
happen before the page has anything to show.
