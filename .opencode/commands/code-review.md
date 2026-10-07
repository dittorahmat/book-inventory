---
description: "Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes: Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/spec asked for?). Runs both reviews in parallel sub-agents and reports them side by side. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to \'review since X\'."
---

Load the `code-review` skill with the skill tool and run its workflow end to end.

**Provided arguments**: $ARGUMENTS

Treat the arguments as direction or scope input for the skill. If no arguments are given, follow the skill's default flow and ask the user only where the skill itself requires input.
