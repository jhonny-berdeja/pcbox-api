#!/usr/bin/env bash
# Validates a Docker Hub Hub API login token. Masking it in the job's
# logs and saving it to $GITHUB_ENV is the caller's job (in
# release-pcbox-api.yml), not this script's.
#
# Usage: validate-docker-hub-api-token.sh <unvalidated-token>
# Exit 0: token is valid. Exit 1: token is empty or the literal "null"
# (jq's output when the login response had no `.token` field).
set -euo pipefail

UNVALIDATED_HUB_API_TOKEN="${1-}"

if [ -z "$UNVALIDATED_HUB_API_TOKEN" ] || [ "$UNVALIDATED_HUB_API_TOKEN" = "null" ]; then
  echo "validate-docker-hub-api-token: failed to log in to the Docker Hub Hub API" >&2
  exit 1
fi

exit 0
