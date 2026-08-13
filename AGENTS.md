# Firewire Agent Entry Point

Before changing this repo, read `agent-docs/AGENTS.md`.

That file and the companion docs under `agent-docs/docs` capture the current application architecture, domain rules, implementation patterns, auth/runtime-config notes, and known refactor concerns for future AI-agent sessions.

## OpenAI Document Analysis

Before making material changes to the AI or document-analysis architecture, read `AI_INTEGRATION_CONTEXT.md` as the product and design context.

- Use Node.js and the official OpenAI JavaScript SDK. Prefer the Responses API for new work unless an existing, documented repository decision requires another API.
- Keep model selection in server-side configuration; do not scatter model names through the codebase. Read `OPENAI_API_KEY` only from secure server-side configuration and never expose it to browser code.
- Treat each customer/project document package as an isolated analysis context. Preserve internal project/document IDs and related OpenAI file/vector-store IDs, and never retrieve or analyze one project's data in another project's context.
- Use explicit JSON Schemas and validated Structured Outputs for machine-consumed results when available; do not rely on prompts that merely request free-form JSON.
- Preserve provenance for material findings, including the source filename and page, section, or location when available. Distinguish document-stated facts, AI interpretations, assumptions, unresolved questions, and externally verified facts.
- Never invent project requirements. Report document conflicts instead of silently resolving them unless precedence is explicit, and treat revisions/addenda as potentially superseding earlier requirements.
- Never use model knowledge alone to declare which fire, building, electrical, life-safety, or related code legally applies. Keep `DOCUMENT-STATED`, `JURISDICTION-VERIFIED`, and `POTENTIALLY-APPLICABLE` separate, and prefer `not found`, `requires verification`, or `unknown` over unsupported certainty.
- Keep ingestion/classification, per-document extraction, project-wide reconciliation, risk/clarification analysis, and final structured output as traceable stages rather than one monolithic prompt.
- Keep AI integration modular for future AHJ/code lookup, addendum impact analysis, proposal generation, RFI drafting, and scope comparison. Favor grounding, traceability, maintainability, and human review over shortcuts.

## Mandatory Non-Human Workflow

Every AI agent, automation, or non-human contributor must follow this workflow for any repository change:

1. Read `agent-docs/AGENTS.md`.
2. Read any relevant files under `agent-docs/docs`.
3. Decide whether the change affects architecture, domain rules, auth/runtime config, environment variables, SQL schema/conventions, API patterns, shared UI patterns, storage behavior, or agent workflow.
4. If documentation is affected, update the docs in the same atomic change as the implementation.
5. Do not present, commit, or open a PR for implementation changes that make these docs stale.
6. In the final response, commit message, or PR description, state either `Docs updated` or `Docs not needed` with a short reason.
