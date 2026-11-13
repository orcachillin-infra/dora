#!/bin/sh
# Forwards inbound game and SFTP traffic for the Pelican nodes from Dora to the
# nodes over NetBird. Idempotent: the PELICAN-FWD chains are rebuilt on every
# run and the PREROUTING/POSTROUTING jumps are only added when missing.
set -eu

PUBLIC_IF=eth0
WGH_IF=wt0
ORKID=100.114.67.239
LUNA=100.114.246.44
GAME_PORTS=27000:27099

# SFTP is plain SSH on its own port per node, so the node names cannot share
# one port here. Each node's daemon_sftp must match the port forwarded below.
ORKID_SFTP=2022
LUNA_SFTP=2023

# Remove the pre-rename chains so this script can be re-run over an older setup.
for chain in PELICAN-LUNA PELICAN-LUNA-POST; do
    while iptables -t nat -D PREROUTING -i "$PUBLIC_IF" -j "$chain" 2>/dev/null; do :; done
    while iptables -t nat -D POSTROUTING -j "$chain" 2>/dev/null; do :; done
    iptables -t nat -F "$chain" 2>/dev/null || true
    iptables -t nat -X "$chain" 2>/dev/null || true
done

iptables -t nat -N PELICAN-FWD 2>/dev/null || true
iptables -t nat -F PELICAN-FWD
iptables -t nat -A PELICAN-FWD -p udp --dport "$GAME_PORTS" -j DNAT --to-destination "$LUNA"
iptables -t nat -A PELICAN-FWD -p tcp --dport "$GAME_PORTS" -j DNAT --to-destination "$LUNA"
iptables -t nat -A PELICAN-FWD -p tcp --dport "$ORKID_SFTP" -j DNAT --to-destination "$ORKID":2022
iptables -t nat -A PELICAN-FWD -p tcp --dport "$LUNA_SFTP" -j DNAT --to-destination "$LUNA":2022

iptables -t nat -C PREROUTING -i "$PUBLIC_IF" -j PELICAN-FWD 2>/dev/null \
    || iptables -t nat -I PREROUTING -i "$PUBLIC_IF" -j PELICAN-FWD

iptables -t nat -N PELICAN-FWD-POST 2>/dev/null || true
iptables -t nat -F PELICAN-FWD-POST
iptables -t nat -A PELICAN-FWD-POST -o "$WGH_IF" -d "$ORKID" -j MASQUERADE
iptables -t nat -A PELICAN-FWD-POST -o "$WGH_IF" -d "$LUNA" -j MASQUERADE

iptables -t nat -C POSTROUTING -j PELICAN-FWD-POST 2>/dev/null \
    || iptables -t nat -A POSTROUTING -j PELICAN-FWD-POST
