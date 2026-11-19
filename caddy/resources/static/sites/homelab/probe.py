#!/usr/bin/env python3
"""
probe the homelab catalog and write status.json for the homepage.

stdlib only. runs anywhere netbird resolves the names. on dora it runs from a
systemd timer every 60s and writes status.json into the site directory, so the
page itself stays fully static and needs no backend.

    python3 probe.py                 # one pass, writes ./status.json
    python3 probe.py --loop 60       # keep running
    python3 probe.py --verbose
"""

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

NETBIRD = "network.orcachill.in"
EXPORTER_PORT = 9100
TIMEOUT = 5.0
USER_AGENT = "homelab-probe/1.0"

HERE = os.path.dirname(os.path.abspath(__file__))

# pseudo filesystems are noise on a stats panel
SKIP_FSTYPES = {
    "tmpfs", "overlay", "squashfs", "ramfs", "devtmpfs",
    "efivarfs", "autofs", "fuse", "rootfs", "cgroup", "debugfs",
}
SKIP_MOUNTS = {"/dev", "/proc", "/sys", "/run", "/boot/efi"}

LINE = re.compile(r"^([A-Za-z0-9_]+)(\{[^}]*\})?\s+([0-9eE+.-]+)$")
LABEL = re.compile(r'([a-z_]+)="([^"]*)"')


def read_catalog(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def label(labels, name):
    for key, value in LABEL.findall(labels):
        if key == name:
            return value
    return None


def first(metrics, name):
    entries = metrics.get(name)
    if not entries:
        return None
    return entries[0][1]


def parse_metrics(text):
    metrics = {}
    for line in text.splitlines():
        match = LINE.match(line)
        if not match:
            continue
        metrics.setdefault(match.group(1), []).append((match.group(2) or "", float(match.group(3))))
    return metrics


def probe_host(host):
    url = f"http://{host}.{NETBIRD}:{EXPORTER_PORT}/metrics"
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT) as resp:
            metrics = parse_metrics(resp.read().decode("utf-8", "replace"))
    except Exception as exc:
        return {"host": host, "state": "down", "error": f"{type(exc).__name__}: {exc}"}

    cores = len({label(labels, "cpu") for labels, _ in metrics.get("node_cpu_seconds_total", [])})

    size = {labels: value for labels, value in metrics.get("node_filesystem_size_bytes", [])}
    free = {labels: value for labels, value in metrics.get("node_filesystem_avail_bytes", [])}
    disks = []
    for labels, total in size.items():
        if total <= 0:
            continue
        mount = label(labels, "mountpoint") or ""
        if (label(labels, "fstype") or "") in SKIP_FSTYPES or mount in SKIP_MOUNTS:
            continue
        disks.append({"mount": mount, "size": int(total), "free": int(free.get(labels, 0))})
    disks.sort(key=lambda disk: -disk["size"])

    total_mem = first(metrics, "node_memory_MemTotal_bytes")
    avail_mem = first(metrics, "node_memory_MemAvailable_bytes")
    boot = first(metrics, "node_boot_time_seconds")
    uname = metrics.get("node_uname_info") or [(" ", "")]

    return {
        "host": host,
        "state": "up",
        "exporter": True,
        "nodename": label(uname[0][0], "nodename") or host,
        "load1": first(metrics, "node_load1"),
        "cores": cores or None,
        "mem_total": int(total_mem) if total_mem else None,
        "mem_used": int(total_mem - avail_mem) if total_mem and avail_mem is not None else None,
        "uptime": int(time.time() - boot) if boot else None,
        "disks": disks,
    }


def probe_service(service):
    result = dict(service)
    url = service.get("url")
    if not url:
        result["state"] = "lan"
        return result

    started = time.monotonic()
    try:
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=TIMEOUT) as resp:
            code = resp.status
            error = None
    except urllib.error.HTTPError as exc:
        code = exc.code
        error = None
    except Exception as exc:
        code = None
        error = f"{type(exc).__name__}: {exc}"

    result["ms"] = round((time.monotonic() - started) * 1000)
    result["code"] = code
    result["error"] = error

    if code is None:
        result["state"] = "down"
    elif code >= 500:
        result["state"] = "degraded"
    elif code >= 400:
        # most of these answer fine on a real path but 404 on the root
        result["state"] = "odd"
    else:
        result["state"] = "up"
    return result


def run(catalog):
    started = time.monotonic()

    entries = [dict(service, group=group["name"]) for group in catalog["groups"] for service in group["services"]]

    with ThreadPoolExecutor(max_workers=16) as pool:
        services = list(pool.map(probe_service, entries))
        hosts = list(pool.map(probe_host, catalog["hosts"]))

    counts = {}
    for service in services:
        counts[service["state"]] = counts.get(service["state"], 0) + 1

    status = {
        "generated_at": int(time.time()),
        "elapsed_ms": round((time.monotonic() - started) * 1000),
        "counts": counts,
        "hosts": sorted(hosts, key=lambda host: host["host"]),
        "services": services,
    }
    return status


def main():
    parser = argparse.ArgumentParser(description="probe the homelab catalog")
    parser.add_argument("--catalog", default=os.path.join(HERE, "services.json"))
    parser.add_argument("--out", default=os.path.join(HERE, "status.json"))
    parser.add_argument("--loop", type=int, default=0, help="seconds to sleep between passes")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    while True:
        catalog = read_catalog(args.catalog)
        status = run(catalog)

        tmp = f"{args.out}.tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(status, fh, indent=2)
        os.replace(tmp, args.out)

        if args.verbose:
            print(f"{status['elapsed_ms']}ms {status['counts']}")

        if not args.loop:
            break
        time.sleep(args.loop)


if __name__ == "__main__":
    main()
