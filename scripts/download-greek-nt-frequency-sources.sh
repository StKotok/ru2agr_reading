#!/usr/bin/env bash
# download-greek-nt-frequency-sources.sh
# Idempotent-ish script: if a target directory already contains a git repo,
# it skips the clone (does NOT fetch/pull to keep commit pinned).
# If you need a fresh clone, remove the target directory first.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RAW_DIR="$BASE_DIR/docs/greek-nt-frequency-sources/raw"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

log() { echo "[$(date -u +"%H:%M:%S")] $*"; }

clone_if_missing() {
  local url="$1"
  local target="$2"
  local label="$3"

  if [ -d "$target/.git" ]; then
    log "SKIP $label — already exists at $target"
    (cd "$target" && git log --oneline -1)
  else
    log "CLONE $label → $target"
    mkdir -p "$(dirname "$target")"
    git clone --depth 1 "$url" "$target"
    log "OK   $label"
  fi
}

get_commit() {
  local dir="$1"
  if [ -d "$dir/.git" ]; then
    (cd "$dir" && git rev-parse HEAD)
  else
    echo "NO_GIT_REPO"
  fi
}

get_commit_short() {
  local dir="$1"
  if [ -d "$dir/.git" ]; then
    (cd "$dir" && git rev-parse --short HEAD)
  else
    echo "NO_GIT_REPO"
  fi
}

# ── Source 1: SBLGNT ──────────────────────────────────────────────────────────
log "===== SOURCE 1: SBLGNT ====="
clone_if_missing \
  "https://github.com/LogosBible/SBLGNT" \
  "$RAW_DIR/sblgnt" \
  "SBLGNT"

# ── Source 2: MACULA Greek ────────────────────────────────────────────────────
log "===== SOURCE 2: MACULA Greek ====="
clone_if_missing \
  "https://github.com/Clear-Bible/macula-greek" \
  "$RAW_DIR/macula-greek" \
  "MACULA Greek"

# ── Source 3: MorphGNT SBLGNT ─────────────────────────────────────────────────
log "===== SOURCE 3: MorphGNT SBLGNT ====="
clone_if_missing \
  "https://github.com/morphgnt/sblgnt" \
  "$RAW_DIR/morphgnt-sblgnt" \
  "MorphGNT SBLGNT"

# ── Source 4: Core GNT Vocab ──────────────────────────────────────────────────
log "===== SOURCE 4: Core GNT Vocab ====="
clone_if_missing \
  "https://github.com/jtauber/core-gnt-vocab" \
  "$RAW_DIR/core-gnt-vocab" \
  "Core GNT Vocab"

# ── Source 5: STEPBible Data ──────────────────────────────────────────────────
log "===== SOURCE 5: STEPBible Data ====="
# Try sparse checkout first; fallback to full shallow clone
STEPBIBLE_TARGET="$RAW_DIR/stepbible-data"
if [ -d "$STEPBIBLE_TARGET/.git" ]; then
  log "SKIP STEPBible Data — already exists at $STEPBIBLE_TARGET"
  (cd "$STEPBIBLE_TARGET" && git log --oneline -1)
else
  log "CLONE STEPBible Data (sparse checkout attempt) → $STEPBIBLE_TARGET"
  mkdir -p "$STEPBIBLE_TARGET"
  # Full shallow clone first — sparse checkout with depth 1 is tricky
  git clone --depth 1 "https://github.com/STEPBible/STEPBible-Data" "$STEPBIBLE_TARGET" 2>&1 || {
    log "WARN STEPBible Data: shallow clone failed — trying without depth limit"
    # Some large repos need more history for sparse checkout to work
    git clone "https://github.com/STEPBible/STEPBible-Data" "$STEPBIBLE_TARGET" 2>&1 || {
      log "ERROR STEPBible Data: full clone failed"
    }
  }
  log "OK   STEPBible Data"
fi

# ── Source 6: OpenGNT ─────────────────────────────────────────────────────────
log "===== SOURCE 6: OpenGNT ====="
clone_if_missing \
  "https://github.com/eliranwong/OpenGNT" \
  "$RAW_DIR/opengnt" \
  "OpenGNT"

# ── Summary ───────────────────────────────────────────────────────────────────
log "===== SUMMARY ====="
for source in sblgnt macula-greek morphgnt-sblgnt core-gnt-vocab stepbible-data opengnt; do
  dir="$RAW_DIR/$source"
  commit=$(get_commit_short "$dir")
  printf "%-20s  %s\n" "$source" "$commit"
done

log "===== DONE ====="
log "Timestamp: $TIMESTAMP"
log "All raw sources in: $RAW_DIR"
