#!/usr/bin/env bash
# Prints a newline-delimited tag file as GitHub-flavored Markdown
# bullet list items (one "- `tag`" line per tag), for GITHUB_STEP_SUMMARY.
# If the file is empty and an empty-message argument is given, prints
# that message as a single italic bullet instead of an empty list. If
# the file is empty and no empty-message is given, prints nothing.
#
# Shared by the "kept tags" and "deleted tags" summary steps in
# release-pcbox-api.yml -- same rendering, only the empty-message
# differs (the kept-tags step passes none, matching its prior
# behavior of showing no fallback line).
#
# Usage: render-tag-list-markdown.sh <tag-file> [empty-message]
set -euo pipefail

TAG_FILE="${1-}"
EMPTY_MESSAGE="${2-}"

if [ -z "$TAG_FILE" ] || [ ! -f "$TAG_FILE" ]; then
  echo "render-tag-list-markdown: tag file not found: '$TAG_FILE'" >&2
  exit 1
fi

if [ -s "$TAG_FILE" ]; then
  while IFS= read -r TAG; do
    [ -z "$TAG" ] && continue
    echo "- \`$TAG\`"
  done < "$TAG_FILE"
elif [ -n "$EMPTY_MESSAGE" ]; then
  echo "- _${EMPTY_MESSAGE}_"
fi
