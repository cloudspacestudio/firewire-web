# Legend And Floorplan Symbol Identification Precision Plan

## Example Failure

A source legend contained two distinct, visually similar devices:

- `GCAVWF` — ceiling-mount LED horn/strobe
- `GCVWF` — ceiling-mount LED strobe

The document inspection discovered `GCAVWF` but omitted `GCVWF`, even though both symbols appeared repeatedly across multiple floorplans.

This is primarily a pipeline recall and identity problem, not simply an inability of the vision model to see the second device.

## Current Vulnerabilities

### Focused glyph localization starts too late

The focused, high-resolution legend-glyph stage only processes BOM candidates emitted by the initial broad document inspection. If that broad pass omits a legend row such as `GCVWF`, later focused legend processing never has an opportunity to recover it.

### Similar floorplan candidates can collapse

Floorplan placements can be associated with the first BOM proposal sharing any normalized identity field, including generic device type or description. Similar ceiling devices can therefore collapse into one candidate even when their part numbers and glyphs differ.

### One request carries too many responsibilities

The broad inspection currently has to understand project details, scope, BOM candidates, quantities, floorplans, placements, legend rows, and other findings. Exhaustive row-level recall competes with all of those other tasks.

## Recommended Improvements

### 1. Make legend extraction an authoritative first stage

Do not rely on the broad document inspection to discover every legend device. Introduce a dedicated legend pass that:

1. Finds every device, equipment, symbol, and annunciation legend.
2. Segments each legend into populated table rows.
3. Processes every row independently.
4. Extracts separate cells for symbol artwork, part number, description, manufacturer, model, and related fields.
5. Assigns a stable `legendRowId` before catalog or floorplan matching.

A populated legend row must remain a candidate even when its quantity is unknown or its glyph contains no text.

### 2. Use positioned PDF text for identifiers

Part/model identifiers should not depend exclusively on visual OCR when the PDF contains searchable text.

- Extract positioned PDF text items.
- Detect table columns and row baselines.
- Associate text items with rows by geometry.
- Use visual OCR only when the text layer is missing or corrupt.
- Preserve character-sensitive identifiers exactly.

`GCAVWF` and `GCVWF` must not be merged merely because their identifiers differ by one character.

### 3. Add legend coverage accounting

The system should report how many populated rows were detected and processed, for example:

> 42 populated device rows detected  
> 42 row records extracted  
> 40 usable glyphs captured  
> 2 glyphs require review

Missing rows must become a visible coverage failure instead of disappearing silently.

### 4. Preserve near-duplicate rows intentionally

When adjacent legend rows have similar identifiers, descriptions, or glyphs, increase scrutiny rather than deduplicating them.

A constrained verification pass should receive both complete row crops and confirm:

- Exact part/model identifier
- Exact description
- Row boundary
- Glyph boundary
- Distinguishing visual characteristics

This is a smaller and more reliable vision task than exhaustive whole-document extraction.

### 5. Separate floorplan detection from classification

Finding symbol-shaped marks and deciding their exact device identity are different operations.

Use a staged floorplan workflow:

1. **Detection:** locate every plausible device mark.
2. **Classification:** compare each detected patch against captured legend glyphs.
3. **Verification:** resolve similar competing candidates or leave the placement unresolved.

Do not discard a detection merely because its identity cannot be determined immediately.

### 6. Supply actual legend glyph references

Floorplan classification should receive the reviewed legend image for each candidate, not only textual metadata.

For a similar pair, the classifier should receive:

- Reference A: `GCAVWF` glyph and complete row identity
- Reference B: `GCVWF` glyph and complete row identity
- The floorplan patch to classify

The prompt should explicitly state that both references are valid, distinct device classes.

### 7. Introduce confusion families

Group commonly confused devices into temporary classification families, such as:

- Ceiling horn/strobe versus ceiling strobe
- Wall versus ceiling notification appliances
- Smoke-detector variants
- Monitor versus control modules
- Sprinkler flow versus tamper devices

Within each family, classification should require the relevant distinguishing visual feature. Prompts should include hard-negative guidance so a generic shared shape is insufficient.

### 8. Combine conventional vision with AI

Construction symbols are structured line drawings, making conventional image analysis useful:

- Normalize glyphs into monochrome edge maps.
- Remove nearby text and circuit lines where possible.
- Compare templates at multiple scales.
- Evaluate contours and connected components.
- Use nearby tag/OCR evidence as a separate signal.
- Ask AI to resolve ambiguity rather than perform every step alone.

A hybrid classification score can combine:

- Glyph-image similarity
- Nearby printed tag evidence
- Legend description compatibility
- AI classification confidence

### 9. Require unambiguous placement association

Placement-to-BOM association should use this priority:

1. Stable `legendRowId` or proposal ID
2. Exact part/model identifier
3. Captured-glyph similarity
4. Exact, unique symbol label
5. Description/device type only when it uniquely identifies one candidate

If a generic description matches multiple candidates, leave the placement unresolved rather than selecting the first match.

### 10. Add a second verifier for uncertain classifications

When the best and second-best candidates are close, run a constrained verification pass containing only:

- The detected floorplan patch
- The two or three competing legend glyphs
- Their exact identifiers and descriptions

If confidence remains low, route the mark to human review instead of forcing a device assignment.

### 11. Retain unmatched-symbol clusters

Cluster repeated floorplan marks that were detected but not classified. A repeated unmatched glyph is strong evidence that a legend row or BOM candidate was missed.

The findings UI should be able to report:

> 18 repeated marks share an unmatched glyph. Review against the source legend.

This creates a recovery path for false-negative legend extraction.

### 12. Build a regression and evaluation package

Retain real examples of frequently confused symbols, including `GCAVWF` and `GCVWF`, and measure:

- Legend-row recall
- Exact part-number accuracy
- Glyph-boundary accuracy
- Floorplan detection recall
- Floorplan classification precision
- Per-device counts
- Cross-classification between similar devices

Use this package to evaluate prompt, model, resolution, tiling, matching, and cleanup changes without regressing already-successful symbols.

## OpenAI API Considerations

There is no special API-key configuration that solves this class of failure. A stronger vision model or higher image detail may provide incremental improvement, but the larger gain will come from restructuring the workflow into smaller constrained tasks.

The model should receive:

- High-resolution row and glyph crops
- Stable candidate identities
- Exact competing alternatives
- Reference legend images
- Explicit negative examples
- Schema-constrained outputs
- A deterministic coverage contract

Fine-tuning should not be the first response. Establish an evaluation set and improve segmentation, identity preservation, and candidate-specific classification first.

## Recommended Implementation Order

1. Add legend-first row segmentation and coverage accounting.
2. Extract exact identifiers from the positioned PDF text layer.
3. Carry a stable `legendRowId` through BOM proposals, glyphs, and placements.
4. Remove ambiguous generic-field-first floorplan association.
5. Provide captured legend glyphs to candidate-specific floorplan classification.
6. Separate floorplan detection from classification.
7. Add near-duplicate/confusion-family verification.
8. Retain and surface unmatched repeated glyph clusters.
9. Add hybrid template/edge matching.
10. Build and continuously run the real-document regression set.

## Success Criteria

- Every populated device legend row produces either a candidate or an explicit review item.
- Similar identifiers remain separate unless deterministic evidence proves duplication.
- Every captured glyph remains tied to its original row identity.
- Generic descriptions cannot silently merge distinct devices.
- Floorplan marks may remain unresolved, but they cannot be silently assigned to an ambiguous sibling.
- Repeated unmatched marks lead back to legend/BOM review.
- Precision and recall can be measured per device against retained real-world examples.

