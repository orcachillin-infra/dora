#!/bin/sh
set -eu

marker=/staging/current/snapshot-created-at
test -s "$marker"

created=$(stat -c %Y "$marker")
now=$(date +%s)
age=$((now - created))

test "$age" -ge 0
test "$age" -le 7200
