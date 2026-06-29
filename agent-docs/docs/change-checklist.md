# Agent Change Checklist

Use this checklist for every non-human workflow before editing and before finishing. The goal is to keep implementation and project memory atomic.

## Before Editing

- [ ] Read `firewire-web/AGENTS.md`.
- [ ] Read `firewire-web/agent-docs/AGENTS.md`.
- [ ] Read the relevant files under `firewire-web/agent-docs/docs`.
- [ ] Search for existing code patterns before creating new components, repositories, services, routes, schemas, or styles.
- [ ] If the work touches Project Detail or Sales Quick Start estimating workflows, inspect the paired surface and shared components for the same required change.
- [ ] If the work touches change orders, preserve the split between live delta data and read-only `worksheetData.changeOrderBaseline` history.
- [ ] Identify whether the change affects documentation.

## Documentation Impact Check

Update docs in the same atomic change if the work affects any of these:

- [ ] Architecture or repo layout.
- [ ] Domain rules or business workflow.
- [ ] Auth, MSAL, Entra, runtime config, or deployment assumptions.
- [ ] Environment variables.
- [ ] SQL schema, migrations, audit fields, or repository conventions.
- [ ] API routes, request/response contracts, or route aliases.
- [ ] Shared Angular components, services, styling, or UI patterns.
- [ ] Azure Blob Storage, SharePoint, Fieldwire, or external integration behavior.
- [ ] Known risks, refactor backlog, or future-agent workflow.

## Before Finishing

- [ ] Code and docs describe the same behavior.
- [ ] Project Detail and Sales Quick Start remain in parity for shared estimating workflows, or any intentional drift is documented.
- [ ] Any required doc updates are included in the same change set.
- [ ] SQL tables preserve created/updated audit fields.
- [ ] Runtime auth config assumptions are preserved.
- [ ] Large document content remains blob-backed for new flows.
- [ ] Generated/build output is not changed unless explicitly requested.
- [ ] Final response, commit message, or PR description says `Docs updated` or `Docs not needed` with a short reason.

## Atomicity Rule

Do not present, commit, or open a PR for implementation changes that require documentation updates unless those documentation updates are included at the same time.
