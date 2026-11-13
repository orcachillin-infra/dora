#!/bin/sh
# Forwards inbound traffic for the Pelican luna node from Dora to Luna over
# NetBird. Idempotent: the PELICAN-LUNA chains are rebuilt on every run and the
# PREROUTING/POSTROUTING jumps are only added when missing.
set -eu

PUBLIC_IF=eth0
WGH_IF=wt0
LUNA=100.114.246.44
GAME_PORTS=27000:27099
SFTP_PORT=2022

iptables -t nat -N PELICAN-LUNA 2>/dev/null || true
iptables -t nat -F PELICAN-LUNA
iptables -t nat -A PELICAN-LUNA -p udp --dport "$GAME_PORTS" -j DNAT --to-destination "$LUNA"
iptables -t nat -A PELICAN-LUNA -p tcp --dport "$GAME_PORTS" -j DNAT --to-destination "$LUNA"
iptables -t nat -A PELICAN-LUNA -p tcp --dport "$SFTP_PORT" -j DNAT --to-destination "$LUNA"

iptables -t nat -C PREROUTING -i "$PUBLIC_IF" -j PELICAN-LUNA 2>/dev/null \
    || iptables -t nat -I PREROUTING -i "$PUBLIC_IF" -j PELICAN-LUNA

iptables -t nat -N PELICAN-LUNA-POST 2>/dev/null || true
iptables -t nat -F PELICAN-LUNA-POST
iptables -t nat -A PELICAN-LUNA-POST -o "$WGH_IF" -d "$LUNA" -j MASQUERADE

iptables -t nat -C POSTROUTING -j PELICAN-LUNA-POST 2>/dev/null \
    || iptables -t nat -A POSTROUTING -j PELICAN-LUNA-POST
