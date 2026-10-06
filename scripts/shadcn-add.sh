#!/bin/sh
# Adds shadcn/ui components to interface/src/components/ui, then rewrites
# their `@/…` imports as relative `.js` paths: tsc's node20 resolution and
# the mocha tests' loader both need them, and the rest of interface/ uses them.
# It also drops their focus rings: index.css draws one 3px ring for all.
# Check `git diff interface/src/styles/index.css` afterwards: shadcn adds its
# own colours there, and Kaitiaki's tokens must stay the only ones.
#
# Usage: sh scripts/shadcn-add.sh table tabs
set -e
# `yes n` keeps every component already here, which Kaitiaki has edited:
# shadcn asks before overwriting one (button.tsx, say) even with --yes. It
# also adds an unrelated npm package named `cn`, removed again below.
yes n | npx --yes shadcn@latest add --yes "$@"
if grep -q '"cn":' package.json; then npm uninstall --silent cn; fi
for f in interface/src/components/ui/*.tsx interface/src/hooks/*.ts; do
  sed -i.bak -E \
    -e 's#from "(@/lib/utils|cn)"#from "../../lib/utils.js"#' \
    -e 's#from "@/components/ui/([a-z-]+)"#from "./\1.js"#' \
    -e 's#from "@/hooks/([a-z-]+)"#from "../../hooks/\1.js"#' "$f"
  sed -i.bak -E "s/ (dark:)?focus-visible:(ring-[^ \"]+|border-ring)//g" "$f"
  rm "$f.bak"
done
