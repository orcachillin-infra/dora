# Komodo

Komodo Core, MongoDB, and the local Dora Periphery agent.

The Compose project runs from `/root/komodo`. Runtime configuration remains outside Git:

- `/root/komodo/compose.env`
- `/root/komodo/secrets/`
- `/var/lib/infisical-agent/rendered/komodo/core.config.toml`

Infisical renders the Git provider configuration. Komodo mounts it read-only at `/config/config.toml`; the GitHub token is not stored in this repository or Komodo's MongoDB.

Periphery mounts the rendered secrets directory read-only so it can resolve Git-backed stack environment files without exposing the Infisical Agent credentials.
