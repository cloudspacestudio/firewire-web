# AI Integration Context

## Purpose

This document is the product and architecture context for integrating
OpenAI into a Node.js application used to analyze construction project
document packages related to:

-   Fire alarm installation
-   Fire sprinkler system installation
-   Electronic security system installation

The application should function as a document-intelligence and
preconstruction review agent. Its job is not merely to summarize files;
it should organize the project package, extract material facts,
reconcile requirements across documents, identify scope and execution
risks, and produce structured results that can be consumed by the
application.

This file should be treated as product/design context.
Repository-specific development conventions and coding instructions
belong in the existing `AGENTS.md`.

------------------------------------------------------------------------

## Primary Use Case

A user uploads a package of project documents. The package may contain
items such as:

-   Plans and drawings
-   Specifications
-   RFP/RFQ documents
-   Bid instructions
-   Addenda
-   Scope letters
-   Equipment schedules
-   Owner standards
-   General notes
-   Contract documents
-   Existing-system information
-   Testing or commissioning requirements
-   Customer correspondence or project instructions

The AI analyzes the complete package and returns a project-level
assessment.

The initial target disciplines are fire alarm, fire sprinkler, and
electronic security.

------------------------------------------------------------------------

## Core Analysis Requirements

### 1. Project and Customer Details

Identify information such as:

-   Customer name
-   Project name
-   Project address
-   City, county, and state
-   Owner
-   General contractor or construction manager, when stated
-   Architect/engineer, when stated
-   Relevant contacts, when appropriate
-   Project type
-   New construction, renovation, expansion, retrofit, or service work
-   System disciplines involved

Do not invent missing project information.

### 2. Document Catalog

Create a catalog of every document analyzed.

For each document, capture where possible:

-   Original filename
-   Document type
-   Discipline
-   Title
-   Document number
-   Revision
-   Date
-   Issuing organization
-   Brief summary
-   Important sections
-   Relationship to other documents

Potential document types include:

-   Drawing
-   Specification
-   Addendum
-   RFP/RFQ
-   Bid form
-   Scope document
-   Contract document
-   Owner standard
-   Equipment schedule
-   Existing-system documentation
-   Correspondence
-   Other

### 3. Scope Extraction

Identify and distinguish:

-   Inclusions
-   Exclusions
-   Assumptions
-   Customer responsibilities
-   Other-trade responsibilities
-   Specific instructions
-   Limitations
-   Alternates
-   Allowances
-   Unit prices
-   Options
-   Delegated-design requirements
-   Permit responsibilities
-   Engineering responsibilities
-   Programming responsibilities
-   Monitoring responsibilities
-   Testing responsibilities
-   Inspection responsibilities
-   Training requirements
-   Closeout requirements
-   Warranty requirements

Do not silently convert an interpretation into a stated requirement.

### 4. Technical Requirements

Extract relevant requirements including:

-   Required manufacturers
-   Existing equipment manufacturers/models
-   Equipment compatibility requirements
-   Approved manufacturers
-   Product requirements
-   Installation requirements
-   Wiring requirements
-   Pathway/conduit requirements
-   Power requirements
-   Interface requirements
-   Network requirements
-   Monitoring requirements
-   Sequence-of-operations requirements
-   Testing requirements
-   Acceptance requirements
-   Submittal requirements
-   Shop drawing requirements
-   Calculation requirements
-   Record/as-built drawing requirements
-   O&M requirements
-   Training requirements
-   Closeout documentation

### 5. Project-Wide Reconciliation

The system must analyze requirements across documents rather than
treating every file independently.

Identify:

-   Conflicting requirements
-   Scope gaps
-   Duplicate requirements
-   Requirements that appear only in one document
-   Drawing/specification inconsistencies
-   Addendum changes
-   Owner-standard requirements that differ from plans/specifications
-   Undefined responsibilities between trades
-   Missing existing-system information
-   Missing design information
-   Ambiguous requirements
-   Information requiring an RFI or bid clarification

If two documents conflict, report the conflict. Do not arbitrarily
decide which document governs unless document precedence is explicitly
established.

### 6. Risk Analysis

Identify estimating, contracting, installation, engineering, scheduling,
and commissioning risks.

Suggested risk categories include:

-   Scope conflict
-   Scope gap
-   Existing-system compatibility
-   Code/AHJ
-   Schedule
-   Procurement/lead time
-   Manufacturer restriction
-   Testing/inspection
-   Other-trade dependency
-   Customer responsibility
-   Permit
-   Engineering
-   Access
-   Phasing
-   Shutdown/impairment
-   After-hours work
-   Unknown existing conditions
-   Missing information

Each risk should contain:

-   Severity
-   Category
-   Description
-   Basis/source
-   Potential impact
-   Recommended action or clarification

The system should distinguish actual documented requirements from
AI-generated risk observations.

------------------------------------------------------------------------

## Code and AHJ Analysis

Code analysis requires special handling.

The AI must NOT determine the legally applicable fire, building,
electrical, life-safety, or related code solely from general model
knowledge.

Applicable requirements can depend on:

-   Project address
-   Authority Having Jurisdiction (AHJ)
-   State and local code adoption
-   Adopted code edition
-   Local amendments
-   Occupancy/use
-   Construction type
-   New versus existing construction
-   Type of system
-   Contract requirements
-   Owner standards
-   Referenced specifications

Potentially relevant standards may include NFPA 72, NFPA 13, and other
standards depending on the system and project, but relevance does not
establish legal applicability or the adopted edition.

### Code Status Model

Every code or standard should be classified into one of these statuses:

#### DOCUMENT-STATED

The project documents explicitly identify the code, standard, or
edition.

#### JURISDICTION-VERIFIED

An authoritative jurisdiction/AHJ source has independently confirmed the
adopted code or standard edition.

#### POTENTIALLY-APPLICABLE

The AI believes the code or standard may be relevant based on the
project/system, but applicability or adoption has not been independently
verified.

These statuses must never be conflated.

Example:

``` json
{
  "code": "NFPA 72",
  "edition": "2019",
  "status": "DOCUMENT-STATED",
  "source": {
    "filename": "Division-28-Spec.pdf",
    "section": "28 31 00 - 1.3"
  }
}
```

If jurisdictional verification has not occurred, the result should
explicitly say so.

The application may eventually implement code/AHJ verification as a
separate capability using authoritative external or internally
maintained jurisdiction data.

------------------------------------------------------------------------

## Provenance and Citations

Traceability is a core product requirement.

Every material extracted fact or conclusion should include provenance
whenever possible.

Example:

``` json
{
  "type": "exclusion",
  "text": "120V branch circuit wiring by electrical contractor",
  "confidence": 0.97,
  "source": {
    "filename": "Division-28-Spec.pdf",
    "page": 14,
    "section": "28 31 00 - 1.6.B"
  }
}
```

The system should preserve distinctions among:

1.  Explicit document facts
2.  AI interpretations
3.  AI-generated assumptions
4.  Unresolved questions
5.  Independently verified external facts

A user reviewing the result should be able to determine why the AI made
a material statement and where the supporting information originated.

------------------------------------------------------------------------

## Recommended Processing Architecture

Do not rely on a single large prompt over the entire package.

Use a multi-stage pipeline conceptually similar to:

``` text
Uploaded Files
      |
      v
Document Catalog / Classification
      |
      v
Per-Document Extraction
      |
      v
Project-Wide Reconciliation
      |
      +--> Scope / Responsibilities
      +--> Requirements
      +--> Code References
      +--> Conflicts / Gaps
      +--> Open Questions
      |
      v
Risk Analysis
      |
      v
Final Structured Project Analysis
```

The implementation can evolve, but maintain separation between
extraction and higher-level reasoning.

### Pass 1: Ingestion and Classification

-   Upload/index documents.
-   Assign internal IDs.
-   Preserve filenames and metadata.
-   Determine document type and discipline.
-   Create document-level summaries.

### Pass 2: Per-Document Extraction

Extract structured facts from each document with provenance.

### Pass 3: Project-Wide Reconciliation

Compare extracted facts across the complete project package.

Identify conflicts, gaps, dependencies, ambiguities, and cross-document
requirements.

### Pass 4: Risk and Clarification Analysis

Generate:

-   Risks
-   Bid questions
-   RFIs/clarifications
-   Missing-information requests
-   Recommended human review items

### Pass 5: Final Structured Output

Produce a strict machine-readable project analysis for storage and
presentation by the Node application.

------------------------------------------------------------------------

## OpenAI Integration Direction

The application will be implemented in Node.js and use the official
OpenAI JavaScript SDK.

Current architectural direction:

-   OpenAI Responses API
-   OpenAI Files API for uploaded documents
-   Project-specific vector stores where appropriate
-   File Search for retrieval over project documents
-   Structured Outputs / JSON Schema for machine-readable responses
-   Server-side API-key management

Example initialization:

``` js
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
```

Never expose the OpenAI API key in browser/client-side code.

The exact model should be configurable rather than unnecessarily
hard-coded throughout the application.

------------------------------------------------------------------------

## Project Isolation

Treat each project/document package as an independent analysis context.

Maintain application-level identifiers such as:

-   Project ID
-   Document ID
-   OpenAI file ID
-   Vector store ID, if used
-   Original filename
-   Revision
-   Upload timestamp
-   Document type
-   Discipline
-   Processing status

Avoid allowing retrieval from one customer/project package to
contaminate another project's analysis.

------------------------------------------------------------------------

## Target Structured Output

The exact schema can evolve, but the project-level result should
conceptually resemble:

``` json
{
  "project": {
    "customerName": "",
    "projectName": "",
    "projectAddress": "",
    "jurisdiction": {
      "city": "",
      "county": "",
      "state": ""
    },
    "systemTypes": []
  },
  "documents": [],
  "scope": {
    "inclusions": [],
    "exclusions": [],
    "assumptions": [],
    "customerResponsibilities": [],
    "otherTradeResponsibilities": [],
    "specificInstructions": [],
    "limitations": [],
    "alternates": []
  },
  "requirements": {
    "equipment": [],
    "manufacturerRequirements": [],
    "installationRequirements": [],
    "testingRequirements": [],
    "submittalRequirements": [],
    "closeoutRequirements": [],
    "scheduleRequirements": []
  },
  "codes": {
    "explicitlyReferenced": [],
    "jurisdictionVerified": [],
    "potentiallyApplicable": [],
    "verificationRequired": []
  },
  "conflicts": [],
  "risks": [],
  "openQuestions": [],
  "executiveSummary": ""
}
```

Prefer schema-constrained model responses rather than asking the model
to "return valid JSON" in free-form instructions.

------------------------------------------------------------------------

## Behavioral Rules for the AI

The eventual system/developer instructions should enforce the following
principles:

1.  Never invent a project requirement.
2.  Clearly distinguish explicit facts, interpretations, assumptions,
    and unresolved questions.
3.  Cite the supporting document/location for material findings whenever
    possible.
4.  Report document conflicts instead of silently resolving them.
5.  Do not infer document precedence unless precedence is explicitly
    established.
6.  Do not determine legally applicable codes solely from model
    knowledge.
7.  Distinguish document-stated codes from jurisdiction-verified codes.
8.  Treat potentially applicable codes as requiring verification.
9.  Surface missing information instead of filling gaps with
    plausible-sounding facts.
10. Prefer "not found" or "requires verification" over unsupported
    certainty.
11. Preserve relevant document revision/date information.
12. Treat addenda and revisions as potentially modifying earlier
    requirements.
13. Flag uncertain existing-system compatibility.
14. Identify responsibilities assigned to the customer, GC, EC, other
    trades, owner, engineer, or third parties.
15. Produce outputs suitable for human review; the AI is assisting
    professional judgment, not replacing AHJ, engineering, contractual,
    or code determinations.

------------------------------------------------------------------------

## Example System Instruction Philosophy

A production prompt should contain concepts similar to:

``` text
You are analyzing construction documents for fire alarm,
fire sprinkler, and electronic security projects.

Never invent a project requirement.

Separate:
1. facts explicitly stated in project documents,
2. reasonable interpretations,
3. assumptions,
4. unresolved questions.

For every material conclusion, identify the supporting
document and location when available.

If documents conflict, report the conflict rather than
choosing one requirement unless document precedence is
explicitly established.

Do not determine the legally applicable building, fire,
electrical, or life-safety code solely from general knowledge.

Report:
- codes explicitly stated in the documents,
- codes potentially applicable,
- codes independently verified against the governing
  jurisdiction/AHJ.

Treat potentially applicable codes as requiring verification.
```

This is design guidance, not necessarily the final production prompt.

------------------------------------------------------------------------

## Desired User Experience

The final experience should give an estimator, project manager,
designer, or reviewer a concise project-level view while allowing them
to trace findings back to source documents.

A useful result might communicate:

-   Number and types of documents reviewed
-   Systems involved
-   Major scope requirements
-   Critical customer instructions
-   Important exclusions and assumptions
-   Existing-system concerns
-   Manufacturer restrictions
-   Testing/inspection requirements
-   Code references and verification status
-   Scope conflicts
-   Missing information
-   High-risk issues
-   Recommended bid questions/RFIs

The interface should prioritize critical findings while still retaining
the complete structured analysis.

------------------------------------------------------------------------

## Future Capabilities

Potential later extensions include:

-   AHJ/code-adoption lookup
-   Automated bid-question generation
-   RFI drafting
-   Proposal scope generation
-   Scope-letter comparison
-   Addendum impact analysis
-   Revision/change detection
-   Equipment takeoff assistance
-   Manufacturer compatibility checks
-   Estimate-review assistance
-   Project handoff summaries
-   Contract-scope comparison
-   Drawing/specification discrepancy detection
-   Integration with internal project/customer systems

These are future directions and should not be assumed implemented unless
the repository already contains them.

------------------------------------------------------------------------

## Development Principle

Build this as a trustworthy document-analysis system rather than a
generic chat wrapper.

The architecture should optimize for:

-   Traceability
-   Structured data
-   Project isolation
-   Explicit uncertainty
-   Repeatability
-   Human review
-   Extensibility
-   Safe treatment of code/AHJ conclusions

When implementation convenience conflicts with traceability or factual
grounding, favor traceability and grounding.
