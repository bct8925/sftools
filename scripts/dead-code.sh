#!/usr/bin/env bash
# Find dead code using dora — filters out property false positives and known exceptions
# Usage: ./scripts/dead-code.sh [--all] [limit]
#   --all   Show all results including ignored symbols

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IGNORE_FILE="$SCRIPT_DIR/dead-code-ignore"
SHOW_ALL=false

if [[ "$1" == "--all" ]]; then
    SHOW_ALL=true
    shift
fi

LIMIT=${1:-100}

dora query "
  SELECT s.kind, s.name, f.path, s.start_line
  FROM symbols s
  JOIN files f ON s.file_id = f.id
  WHERE s.reference_count = 0
    AND s.is_local = 0
    AND s.kind NOT IN ('property', 'parameter', 'module', 'constructor')
  ORDER BY f.path, s.start_line
  LIMIT $LIMIT
" 2>/dev/null | python3 -c "
import json, sys, os

show_all = '$SHOW_ALL' == 'true'
ignore_file = '$IGNORE_FILE'

# Load ignore list
ignored = set()
if os.path.exists(ignore_file):
    with open(ignore_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                ignored.add(line)

data = json.load(sys.stdin)
rows = data.get('rows', [])

if not rows:
    print('No dead symbols found.')
    sys.exit(0)

# Clean symbol name — dora appends '().' to functions and '.' to others
def clean_name(name):
    import re
    return re.sub(r'\(\)\.*$', '', name).rstrip('.')

# Filter
dead = []
skipped = 0
for r in rows:
    key = r['path'] + ':' + clean_name(r['name'])
    if key in ignored and not show_all:
        skipped += 1
    else:
        dead.append(r)

if not dead:
    print(f'No new dead symbols. ({skipped} known exceptions ignored)')
    sys.exit(0)

# Group by file
current_file = None
for r in dead:
    if r['path'] != current_file:
        current_file = r['path']
        print(f'\n  {current_file}')
    name = clean_name(r['name'])
    print(f'    {r[\"kind\"]:12s} {name:40s} :{r[\"start_line\"]}')

print(f'\n  Found: {len(dead)} dead symbols', end='')
if skipped:
    print(f' ({skipped} known exceptions ignored)')
else:
    print()
"
