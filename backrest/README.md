# Dora Backrest

Backrest runs locally on Dora and writes encrypted backups directly to the B2 `dora` repository. Its HTTP port is bound to loopback only. Backrest multihost sends operation status to the Orkid instance for centralized monitoring.

## Snapshot Flow

The `backrest-snapshot.timer` creates an atomic staging tree every day at `02:30` UTC, after Kanidm's `02:17` online backup. It includes:

- A compressed logical dump of Komodo's MongoDB database.
- A custom-format logical dump of Infisical's PostgreSQL database.
- Infisical deployment configuration and recovery secrets.
- Kanidm online backups and private PKI.
- Komodo database exports, runtime configuration, OIDC secret, and signing keys.
- Dora's Backrest configuration.

Live database volume files and Infisical's Redis cache are deliberately excluded. The Backrest plan runs at `03:00` UTC and its start hook rejects snapshots older than two hours.

## Install Paths

- Runtime state: `/var/lib/backrest-dora`
- Rendered B2 environment: `/var/lib/infisical-agent/rendered/backrest/backrest.env`
- Snapshot executable: `/usr/local/sbin/prepare-dora-backup`
- Snapshot service: `/etc/systemd/system/backrest-snapshot.service`
- Snapshot timer: `/etc/systemd/system/backrest-snapshot.timer`

Use repository URI `b2:<B2_BUCKET>:dora`. Suggested retention is seven daily, four weekly, twelve monthly, and three yearly snapshots, with monthly prune and integrity checks.
