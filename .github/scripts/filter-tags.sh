#!/usr/bin/env bash
# Filters a newline-delimited tag file into a "keep" or "delete" set,
# based on whether each tag matches either of two kept tags (the
# previous-stable tag and the new tag). Prints matching lines to
# stdout, one per line, in the same order as the input file.
#
# Shared by both the "tags to keep" and "tags to delete" steps in
# release-pcbox-api.yml -- same partition, opposite side, so one
# script covers both instead of duplicating the loop.
#
# Usage: filter-tags.sh <keep|delete> <tag-file> <kept-tag-1> <kept-tag-2>
set -euo pipefail

FILTER_MODE="${1-}"
TAG_FILE="${2-}"
KEPT_TAG_1="${3-}"
KEPT_TAG_2="${4-}"

if [ "$FILTER_MODE" != "keep" ] && [ "$FILTER_MODE" != "delete" ]; then
  echo "filter-tags: first argument must be 'keep' or 'delete'" >&2
  exit 1
fi

if [ -z "$TAG_FILE" ] || [ ! -f "$TAG_FILE" ]; then
  echo "filter-tags: tag file not found: '$TAG_FILE'" >&2
  exit 1
fi

while IFS= read -r TAG; do
  [ -z "$TAG" ] && continue
  IS_KEPT=0
  if [ "$TAG" = "$KEPT_TAG_1" ] || [ "$TAG" = "$KEPT_TAG_2" ]; then
    IS_KEPT=1
  fi
  if [ "$FILTER_MODE" = "keep" ] && [ "$IS_KEPT" -eq 1 ]; then
    echo "$TAG"
  elif [ "$FILTER_MODE" = "delete" ] && [ "$IS_KEPT" -eq 0 ]; then
    echo "$TAG"
  fi
done < "$TAG_FILE"
