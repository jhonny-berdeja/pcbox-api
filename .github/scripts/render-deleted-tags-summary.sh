#!/usr/bin/env bash
# Renders the "deleted tags" section of the GITHUB_STEP_SUMMARY for
# release-pcbox-api.yml: title and the bullet list of deleted tags
# (or a "(ninguno)" fallback if none were deleted). Prints Markdown to
# stdout -- appending it to $GITHUB_STEP_SUMMARY is the caller's job
# (in release-pcbox-api.yml), not this script's.
#
# Usage: render-deleted-tags-summary.sh <delete-tag-file>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DELETE_TAG_FILE="${1-}"

if [ -z "$DELETE_TAG_FILE" ]; then
  echo "render-deleted-tags-summary: expected <delete-tag-file>" >&2
  exit 1
fi

echo ""
echo "**Tags eliminados:**"
echo ""
"$SCRIPT_DIR/render-tag-list-markdown.sh" "$DELETE_TAG_FILE" "(ninguno)"
