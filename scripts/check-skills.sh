#!/usr/bin/env bash
# Lint skills/*/SKILL.md against STYLE.md. Zero dependencies.
# Usage: bash scripts/check-skills.sh [file ...]     (default: every skills/*/SKILL.md)
set -uo pipefail

if [ "$#" -gt 0 ]; then files=("$@"); else shopt -s nullglob; files=( skills/*/SKILL.md ); fi

required_frontmatter=( "^name:" "^description:" )
mutating_sections=( "^## Inputs" "^## Steps" "^## Output" "^## Halt rules" "^## Self-check" "^## Anti-rambling" )
max_lines=150
max_desc=160
fail=0

for file in "${files[@]}"; do
  [ -f "$file" ] || continue
  for key in "${required_frontmatter[@]}"; do
    grep -qE "$key" "$file" || { echo "FAIL $file: missing frontmatter ${key#^}"; fail=1; }
  done
  desc=$(grep -m1 -E "^description:" "$file" | sed 's/^description: *//')
  if [ "${#desc}" -gt "$max_desc" ]; then echo "FAIL $file: description ${#desc} chars (>$max_desc)"; fail=1; fi
  if grep -qE "^user-invocable: false" "$file"; then continue; fi
  if grep -qE "^allowed-tools:.*(Write|Edit|Bash\(git|Bash\(gh|bin/gh-cli)" "$file" || grep -qE "^## Steps" "$file"; then
    for sec in "${mutating_sections[@]}"; do
      grep -qE "$sec" "$file" || { echo "FAIL $file: mutating skill missing section ${sec#^}"; fail=1; }
    done
  fi
  lines=$(wc -l < "$file")
  if [ "$lines" -gt "$max_lines" ]; then echo "FAIL $file: $lines lines (>$max_lines) — move material to references/"; fail=1; fi
  if grep -qE "You are an? (expert|senior|helpful)" "$file"; then echo "FAIL $file: role preamble"; fail=1; fi
  if grep -qP "[\x{1F300}-\x{1FAFF}\x{2705}\x{274C}]" "$file" 2>/dev/null; then echo "FAIL $file: emoji"; fail=1; fi
done

# placeholder table check: every {{SLOT}} used in prompts must appear in the owning SKILL.md
for skill in skills/*/; do
  [ -d "$skill/prompts" ] || continue
  used=$(grep -ohE "\{\{[A-Z_]+\}\}" "$skill"/prompts/*.md 2>/dev/null | sort -u)
  for slot in $used; do
    grep -q -- "$slot" "$skill/SKILL.md" || { echo "FAIL $skill: prompt slot $slot not declared in SKILL.md placeholder table"; fail=1; }
  done
done

if [ "$fail" -eq 1 ]; then echo; echo "Skill lint failed. See STYLE.md."; exit 1; fi
echo "OK: skills conform to STYLE.md."
