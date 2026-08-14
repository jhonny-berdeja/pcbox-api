#!/usr/bin/env bash
# Waits for the infra-hub deploy run dispatched at or after
# <since-timestamp> to finish, and fails if it didn't succeed.
# `gh workflow run` (used by dispatch-infra-hub-deploy.sh) is
# fire-and-forget -- it returns as soon as GitHub accepts the
# dispatch, before the triggered workflow even starts. This script
# finds that run and blocks until it's done, so a caller never treats
# "the deploy was dispatched" as "the deploy succeeded".
#
# Retry count/interval are overridable via
# WAIT_FOR_INFRA_HUB_DEPLOY_MAX_ATTEMPTS / _SLEEP_SECONDS (defaults:
# 12 attempts, 5s apart -- up to 60s for the dispatched run to show up
# in the list) so tests don't have to sleep for real.
#
# Usage: wait-for-infra-hub-deploy.sh <repository-owner> <since-timestamp-utc>
set -euo pipefail

REPOSITORY_OWNER="${1-}"
SINCE_TIMESTAMP="${2-}"

if [ -z "$REPOSITORY_OWNER" ] || [ -z "$SINCE_TIMESTAMP" ]; then
  echo "wait-for-infra-hub-deploy: expected <repository-owner> <since-timestamp-utc>" >&2
  exit 1
fi

REPO="$REPOSITORY_OWNER/infra-hub"
WORKFLOW="deploy-pcbox-api.yml"
MAX_ATTEMPTS="${WAIT_FOR_INFRA_HUB_DEPLOY_MAX_ATTEMPTS:-12}"
SLEEP_SECONDS="${WAIT_FOR_INFRA_HUB_DEPLOY_SLEEP_SECONDS:-5}"

RUN_ID=""
for _ in $(seq 1 "$MAX_ATTEMPTS"); do
  RUN_ID="$(gh run list --repo "$REPO" --workflow="$WORKFLOW" --event=workflow_dispatch --json databaseId,createdAt | \
    jq -r --arg since "$SINCE_TIMESTAMP" \
      '[.[] | select(.createdAt >= $since)] | sort_by(.createdAt) | .[0].databaseId // empty')"
  if [ -n "$RUN_ID" ]; then
    break
  fi
  sleep "$SLEEP_SECONDS"
done

if [ -z "$RUN_ID" ]; then
  echo "wait-for-infra-hub-deploy: could not find a run of $WORKFLOW in $REPO created at or after $SINCE_TIMESTAMP" >&2
  exit 1
fi

echo "Watching infra-hub run $RUN_ID..."
gh run watch "$RUN_ID" --repo "$REPO" --exit-status
