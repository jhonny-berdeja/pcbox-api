#!/usr/bin/env bash
# Renders the "view tags in Docker Hub" link section of the
# GITHUB_STEP_SUMMARY for release-pcbox-api.yml. Prints Markdown to
# stdout -- appending it to $GITHUB_STEP_SUMMARY is the caller's job
# (in release-pcbox-api.yml), not this script's.
#
# Usage: render-docker-hub-link-summary.sh <dockerhub-username>
set -euo pipefail

DOCKERHUB_USERNAME="${1-}"

if [ -z "$DOCKERHUB_USERNAME" ]; then
  echo "render-docker-hub-link-summary: expected <dockerhub-username>" >&2
  exit 1
fi

echo ""
echo "**[▶ Ver los tags en Docker Hub](https://hub.docker.com/r/$DOCKERHUB_USERNAME/pcbox-api/tags)**"
