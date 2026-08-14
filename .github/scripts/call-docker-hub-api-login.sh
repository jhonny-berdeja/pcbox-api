#!/usr/bin/env bash
# Calls the Docker Hub Hub API login endpoint with the given request
# body and prints the token from the response to stdout (unvalidated
# -- the caller is responsible for checking it before trusting it).
# Saving it to $GITHUB_ENV is the caller's job (in
# release-pcbox-api.yml), not this script's.
#
# Usage: call-docker-hub-api-login.sh <login-body-json>
set -euo pipefail

LOGIN_BODY="${1-}"

if [ -z "$LOGIN_BODY" ]; then
  echo "call-docker-hub-api-login: expected the login body JSON as the first argument" >&2
  exit 1
fi

curl -sf -X POST "https://hub.docker.com/v2/users/login/" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_BODY" | jq -r '.token'
