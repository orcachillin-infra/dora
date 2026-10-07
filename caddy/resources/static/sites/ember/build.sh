#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

cleanup() {
	rm -rf node_modules .vite
}
trap cleanup EXIT INT TERM

npm ci --no-audit --no-fund
npm run build
