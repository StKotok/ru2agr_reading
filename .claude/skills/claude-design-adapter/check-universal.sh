#!/bin/sh
# Guard: claude-design-adapter must stay project-agnostic.
# Fails (exit 1) if any known project/runtime identifier leaks into a *.md file.
# Patterns target the contamination source for this checkout (a host project's
# DC prototype). Add new leak vectors here as they appear.
# The grep uses --include='*.md', so this .sh file (which holds the patterns) is
# never scanned and cannot self-match.
cd "$(dirname "$0")" || exit 2

pattern='ru2gr|\?dev=1|data-section|createElement|\bmk\(|buildReaderPalette|LV_TABLE|C\.(paper|ink|line|muted|paper2|card|read)|\bTK\.|\.dc\.html|MutationObserver|localhost:[0-9]+|Пергамент|Уголь'

if grep -rniE --include='*.md' "$pattern" .; then
  echo "LEAK: project-specific identifier found above — keep this skill universal." >&2
  exit 1
fi

echo "clean"
