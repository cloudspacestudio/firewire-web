# Firewire Agent Entry Point

Before changing this repo, read `agent-docs/AGENTS.md`.

That file and the companion docs under `agent-docs/docs` capture the current application architecture, domain rules, implementation patterns, auth/runtime-config notes, and known refactor concerns for future AI-agent sessions.

## Mandatory Non-Human Workflow

Every AI agent, automation, or non-human contributor must follow this workflow for any repository change:

1. Read `agent-docs/AGENTS.md`.
2. Read any relevant files under `agent-docs/docs`.
3. Decide whether the change affects architecture, domain rules, auth/runtime config, environment variables, SQL schema/conventions, API patterns, shared UI patterns, storage behavior, or agent workflow.
4. If documentation is affected, update the docs in the same atomic change as the implementation.
5. Do not present, commit, or open a PR for implementation changes that make these docs stale.
6. In the final response, commit message, or PR description, state either `Docs updated` or `Docs not needed` with a short reason.
