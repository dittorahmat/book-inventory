---
description: "Set up Claude Code hooks to block dangerous git commands (push, reset --hard, clean, branch -D, etc.) before they execute. Use when user wants to prevent destructive git operations, add git safety hooks, or block git push/reset in Claude Code."
---

Load the `git-guardrails-claude-code` skill with the skill tool and run its workflow end to end.

**Provided arguments**: $ARGUMENTS

Treat the arguments as direction or scope input for the skill. If no arguments are given, follow the skill's default flow and ask the user only where the skill itself requires input.
