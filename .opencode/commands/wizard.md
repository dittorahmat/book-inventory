---
description: "Generate an interactive bash wizard that walks a human through steps only they can perform. Use when provisioning infrastructure, setting up credentials or CI secrets, walking an unfamiliar third-party dashboard, or running a one-off migration or cutover. Don't invoke this for steps the agent can perform itself."
---

Load the `wizard` skill with the skill tool and run its workflow end to end.

**Provided arguments**: $ARGUMENTS

Treat the arguments as direction or scope input for the skill. If no arguments are given, follow the skill's default flow and ask the user only where the skill itself requires input.
