# Entity Diagram Image Workflow

Use this workflow when a presentation-ready entity table image is needed for a SQL Server backend table.

1. Confirm the current table shape from the SQL DDL and runtime schema guard.
2. Add or update an entity JSON file in `firewire-web/agent-docs/entity-images/`.
3. Render the PNG with:

```bash
swift firewire-web/agent-docs/entity-images/render-entity-table.swift \
  firewire-web/agent-docs/entity-images/parts.entity.json \
  firewire-web/agent-docs/entity-images/parts.png
```

The JSON format is:

```json
{
  "title": "Entity Name",
  "rows": [
    ["Logical Name", "fieldName", "Human readable description", "data type"]
  ]
}
```

Keep the row order aligned with the SQL table column order. Use logical data types for presentation clarity, such as `guid`, `string`, `text`, `money`, `integer`, and `datetime`.
