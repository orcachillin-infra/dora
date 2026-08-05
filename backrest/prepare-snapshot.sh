#!/usr/bin/env bash
set -euo pipefail

umask 077

staging=/var/lib/backrest-dora/staging
next="$staging/next"
current="$staging/current"
previous="$staging/previous"

exec 9>"$staging/.snapshot.lock"
flock -n 9

rm -rf "$next"
trap 'rm -rf "$next"' EXIT

install -d -m 700 \
  "$next/databases" \
  "$next/infisical" \
  "$next/kanidm/backups" \
  "$next/kanidm/pki" \
  "$next/komodo/backups" \
  "$next/komodo/config" \
  "$next/komodo/keys" \
  "$next/backrest"

for container in komodo-mongo-1 infisical-db; do
  test "$(docker --remote inspect -f '{{.State.Running}}' "$container")" = true
done

kanidm_backups=(/var/lib/kanidm/backups/backup-*.json.gz)
test -e "${kanidm_backups[0]}"
latest_kanidm_backup=${kanidm_backups[${#kanidm_backups[@]} - 1]}
test "$(( $(date +%s) - $(stat -c %Y "$latest_kanidm_backup") ))" -le 172800

set -a
. /root/komodo/compose.env
set +a

docker --remote exec komodo-mongo-1 mongodump \
  --quiet \
  --username "$KOMODO_DATABASE_USERNAME" \
  --password "$KOMODO_DATABASE_PASSWORD" \
  --authenticationDatabase admin \
  --db komodo \
  --archive \
  --gzip >"$next/databases/komodo.archive.gz"

docker --remote exec infisical-db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  >"$next/databases/infisical.dump"

gzip -t "$next/databases/komodo.archive.gz"
docker --remote exec -i infisical-db pg_restore --list \
  <"$next/databases/infisical.dump" >/dev/null

cp -a /root/infisical/. "$next/infisical/"
cp -a /var/lib/kanidm/backups/. "$next/kanidm/backups/"
cp -a /var/lib/kanidm/pki/. "$next/kanidm/pki/"
cp -a /etc/komodo/backups/. "$next/komodo/backups/"
cp -a /root/komodo/. "$next/komodo/config/"
cp -a /var/lib/containers/storage/volumes/komodo_keys/_data/. "$next/komodo/keys/"

if [[ -f /var/lib/backrest-dora/config/config.json ]]; then
  cp -a /var/lib/backrest-dora/config/config.json "$next/backrest/config.json"
fi

date -u +%Y-%m-%dT%H:%M:%SZ >"$next/snapshot-created-at"

rm -rf "$previous"
if [[ -d "$current" ]]; then
  mv "$current" "$previous"
fi
mv "$next" "$current"
rm -rf "$previous"
trap - EXIT
