---
applyTo: '**/*.{ts,tsx,js,jsx,go,py,rs}'
---

# Code Review Format

One line per finding:

```text
[ID] file:line SEVERITY/confidence Problem → Fix
```

Severity: ERROR / WARN / INFO. Confidence: high / med / low.
`Problem → Fix` ≤ 80 chars. No prose explanations.

> Review-Format-Scope hat Vorrang vor allgemeinen Stilregeln (copilot-instructions.md)
> wo sie kollidieren.
