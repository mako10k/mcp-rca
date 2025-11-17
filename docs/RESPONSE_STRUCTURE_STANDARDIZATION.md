# Response Structure Standardization (Issue #8)

## Overview

All mutation tools now follow a consistent response structure to improve developer experience, type safety, and API predictability.

## Standard Response Patterns

### Mutation Tools (Single Resource)

All mutation tools that create, update, or remove a single resource return:

```typescript
{
  caseId: string;
  [resourceName]: Resource;
  case: Case;
}
```

**Examples:**
- `observation_add`: `{ caseId, observation, case }`
- `observation_update`: `{ caseId, observation, case }`
- `observation_remove`: `{ caseId, observation, case }`
- `hypothesis_update`: `{ caseId, hypothesis, case }`
- `hypothesis_remove`: `{ caseId, hypothesis, case }`
- `hypothesis_finalize`: `{ caseId, hypothesis, case }`
- `test_plan_create`: `{ caseId, testPlan, case }`
- `test_plan_update`: `{ caseId, testPlan, case }`
- `test_plan_remove`: `{ caseId, testPlan, case }`
- `case_create`: `{ caseId, case }`
- `case_update`: `{ caseId, case }`
- `conclusion_finalize`: `{ caseId, conclusion, case }`

### Mutation Tools (Multiple Resources)

Mutation tools that create multiple resources return:

```typescript
{
  caseId: string;
  [resourcesPlural]: Resource[];
  case: Case;
}
```

**Example:**
- `hypothesis_propose`: `{ caseId, hypotheses, case }`

### Query Tools

Query tools follow their specific patterns:

- `case_get`: `{ case, cursors?: { nextObservationCursor } }`
- `case_list`: `{ cases, nextCursor?, total }`

## Benefits

1. **Consistency**: All mutation tools follow the same pattern
2. **Context Access**: Always have `caseId` at top level for routing/logging
3. **Immediate State**: Full `case` object available without additional queries
4. **Type Safety**: Shared TypeScript interfaces for similar operations
5. **Token Optimization**: Works well with Issue #7's optimization strategies (use `include` parameter on `case_get` to fetch only needed data)

## Backward Compatibility

This is a **non-breaking change** - we only added fields, did not remove any. All existing integrations continue to work.

## Migration Guide

If you were previously extracting `caseId` from nested resources:

```typescript
// Old approach
const { hypothesis } = await hypothesis_update(...);
const caseId = hypothesis.caseId;

// New approach (but old still works)
const { caseId, hypothesis } = await hypothesis_update(...);
```

If you were previously making separate `case_get` calls:

```typescript
// Old approach
const { testPlanId } = await test_plan_create(...);
const { case } = await case_get({ caseId });

// New approach
const { caseId, testPlan, case } = await test_plan_create(...);
```

## Related

- Issue #8: API response structure consistency
- Issue #7: API response verbosity (token consumption optimization)
- docs/RESPONSE_STRUCTURE_ANALYSIS.md: Detailed analysis and recommendations
