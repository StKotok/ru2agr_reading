#!/bin/sh
# Guard: claude-design-adapter must not leak host-PROJECT specifics into its docs.
# Fails (exit 1) if a project-specific identifier leaks into a *.md file.
# NB: the DC format itself (Claude Design exports) is the skill's v1 domain, so generic
# DC / .dc.html terms are ALLOWED; only host-project identifiers (theme names, helper/token
# names, a specific app's runtime hooks) are banned. Add new leak vectors as they appear.
# The grep uses --include='*.md', so this .sh file (which holds the patterns) is
# never scanned and cannot self-match.
cd "$(dirname "$0")" || exit 2

pattern='ru2gr|\?dev=1|data-section|createElement|\bmk\(|buildReaderPalette|LV_TABLE|C\.(paper|ink|line|muted|paper2|card|read)|\bTK\.|MutationObserver|localhost:[0-9]+|Пергамент|Уголь'

if grep -rniE --include='*.md' "$pattern" .; then
  echo "LEAK: project-specific identifier found above — keep this skill universal." >&2
  exit 1
fi

echo "clean"
