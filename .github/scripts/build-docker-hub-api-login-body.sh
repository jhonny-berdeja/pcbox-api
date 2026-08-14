#!/usr/bin/env bash
# Builds the Docker Hub Hub API login request body
# ({"username": "...", "password": "..."}) and prints it to stdout as
# a single line. Saving it to $GITHUB_ENV is the caller's job (in
# release-pcbox-api.yml), not this script's.
#
# `jq -n` alone pretty-prints across multiple lines by default -- that
# would break $GITHUB_ENV's KEY=VALUE format if the caller echoed this
# output there directly (it expects a single line, or the <<EOF
# heredoc syntax for multi-line values). The `-c` flag forces
# single-line compact output so the caller's plain `echo ... >>
# "$GITHUB_ENV"` stays valid.
#
# Requires DOCKERHUB_USERNAME and DOCKERHUB_TOKEN as environment
# variables.
#
# Usage: build-docker-hub-api-login-body.sh
set -euo pipefail

if [ -z "${DOCKERHUB_USERNAME-}" ] || [ -z "${DOCKERHUB_TOKEN-}" ]; then
  echo "build-docker-hub-api-login-body: DOCKERHUB_USERNAME and DOCKERHUB_TOKEN must both be set" >&2
  exit 1
fi

jq -n -c --arg username "$DOCKERHUB_USERNAME" --arg password "$DOCKERHUB_TOKEN" \
  '{username: $username, password: $password}'
