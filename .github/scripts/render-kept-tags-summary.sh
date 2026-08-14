#!/usr/bin/env bash
# Renders the "kept tags" section of the GITHUB_STEP_SUMMARY for
# release-pcbox-api.yml: header, intro sentence, and the bullet list
# of kept tags. Prints Markdown to stdout -- appending it to
# $GITHUB_STEP_SUMMARY is the caller's job (in release-pcbox-api.yml),
# not this script's.
#
# Usage: render-kept-tags-summary.sh <previous-stable-tag> <new-tag> <keep-tag-file>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PREVIOUS_STABLE_TAG="${1-}"
NEW_TAG="${2-}"
KEEP_TAG_FILE="${3-}"

if [ -z "$PREVIOUS_STABLE_TAG" ] || [ -z "$NEW_TAG" ] || [ -z "$KEEP_TAG_FILE" ]; then
  echo "render-kept-tags-summary: expected <previous-stable-tag> <new-tag> <keep-tag-file>" >&2
  exit 1
fi

echo "## 🧹 Limpieza de tags de pcbox-api en Docker Hub"
echo ""
echo "Se conservaron los tags \`$PREVIOUS_STABLE_TAG\` (estable anterior) y \`$NEW_TAG\` (recién deployado). El resto se borró del repositorio en Docker Hub."
echo ""
echo "**Tags conservados:**"
echo ""
"$SCRIPT_DIR/render-tag-list-markdown.sh" "$KEEP_TAG_FILE"
