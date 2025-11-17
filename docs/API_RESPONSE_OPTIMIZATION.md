# API Response Optimization Guide

## Problem
Many RCA tools return the complete `case` object in their responses, which can lead to:
- High token consumption (thousands of tokens per operation)
- Network bandwidth overhead
- Unnecessary data transfer

## Solution: Use Targeted Queries

### Recommended Pattern

Instead of relying on the `case` field in mutation responses, use `case_get` with selective `include` parameters:

```javascript
// ❌ Inefficient: Receiving full case on every operation
const result1 = await observation_add({ caseId, what: "..." });
// result1.case contains ALL observations, hypotheses, tests, results

const result2 = await observation_add({ caseId, what: "..." });
// result2.case again contains EVERYTHING

// ✅ Efficient: Fetch only what you need, when you need it
await observation_add({ caseId, what: "..." });
await observation_add({ caseId, what: "..." });

// Only fetch case data when you actually need it
const caseData = await case_get({
  caseId,
  include: ['observations'],  // Only observations, not hypotheses/tests/results
});
```

### Optimization Strategies

#### 1. Batch Operations
```javascript
// Add multiple observations
await observation_add({ caseId, what: "Observation 1" });
await observation_add({ caseId, what: "Observation 2" });
await observation_add({ caseId, what: "Observation 3" });

// Fetch once at the end
const caseData = await case_get({ caseId });
```

#### 2. Selective Include
```javascript
// Only fetch what you need
const caseData = await case_get({
  caseId,
  include: ['observations', 'hypotheses'],  // Exclude tests and results
});
```

#### 3. Summary-only Queries
```javascript
// For just checking counts
const result = await case_get({ caseId, include: [] });
// Returns case metadata without collections via result.case
// result.cursors is undefined because no collections were requested
```

### Token Savings Examples

**Before optimization:**
```javascript
// Operation 1: ~5000 tokens (full case with 10 observations, 3 hypotheses, 5 tests)
await observation_add({ ... });

// Operation 2: ~5000 tokens (full case again)
await observation_add({ ... });

// Total: ~10000 tokens
```

**After optimization:**
```javascript
// Operation 1: ~200 tokens (just the new observation)
await observation_add({ ... });

// Operation 2: ~200 tokens (just the new observation)
await observation_add({ ... });

// Fetch once: ~5000 tokens
await case_get({ caseId, include: ['observations'] });

// Total: ~5400 tokens (46% reduction)
```

## Affected Tools

The following tools return a complete `case` object in their responses:

- `observation_add`
- `observation_update`
- `observation_remove`
- `hypothesis_update`
- `hypothesis_finalize`
- `hypothesis_remove`
- `test_plan_update`
- `test_plan_remove`
- `case_update`
- `conclusion_finalize`

## Best Practices

1. **Ignore the `case` field** in mutation responses unless you specifically need it immediately
2. **Use `case_get`** with selective `include` when you need case data
3. **Batch operations** before fetching the updated case
4. **Cache case data** on the client side when appropriate
5. **Use pagination** for large observation/test collections
6. **Inspect `result.cursors`** to drive observation pagination (limit, total, hasMore)

## Future Enhancements

Potential improvements being considered:
- Add `includeCase: boolean` parameter to mutation tools (default: true for backward compatibility)
- Provide case summary (counts only) instead of full collections
- Add `fields` parameter for fine-grained control

## Related

- Issue #7: API response verbosity
- `case_get` documentation in AGENT.md
