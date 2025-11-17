# API Response Structure Analysis

## Current State

### Mutation Tools (Create/Add/Update/Remove)

#### Pattern 1: `{ caseId, [resource], case }` (Most Common)
Used by:
- `observation_add`: `{ caseId, observation, case }`
- `observation_update`: `{ caseId, observation, case }`
- `observation_remove`: `{ caseId, observation, case }`
- `hypothesis_update`: `{ hypothesis, case }` ⚠️ Missing `caseId`
- `hypothesis_remove`: `{ hypothesis, case }` ⚠️ Missing `caseId`
- `hypothesis_finalize`: `{ hypothesis, case }` ⚠️ Missing `caseId`
- `test_plan_update`: `{ testPlan, case }` ⚠️ Missing `caseId`
- `test_plan_remove`: `{ testPlan, case }` ⚠️ Missing `caseId`

#### Pattern 2: `{ caseId, case }` (Simple Create)
Used by:
- `case_create`: `{ caseId, case }`
- `case_update`: `{ case }` ⚠️ Missing `caseId`

#### Pattern 3: `{ [resourceId], status?, notes? }` (Minimal)
Used by:
- `test_plan_create`: `{ testPlanId, status, notes? }` ⚠️ Missing `caseId` and `case`

#### Pattern 4: `{ [resources] }` (Resource Only)
Used by:
- `hypothesis_propose`: `{ hypotheses }` ⚠️ Missing `caseId` and `case`

#### Pattern 5: `{ conclusion }` (Special)
Used by:
- `conclusion_finalize`: `{ conclusion }` ⚠️ Missing `caseId` and `case`

### Query Tools

#### Pattern A: `{ case, cursors? }`
Used by:
- `case_get`: `{ case, cursors?: { nextObservationCursor } }`

#### Pattern B: `{ cases, pagination }`
Used by:
- `case_list`: `{ cases, nextCursor?, total }`

#### Pattern C: `{ ranked }` (Special)
Used by:
- `test_prioritize`: `{ ranked }` (Utility tool, no case context)

#### Pattern D: Guidance Tools (Various)
- `guidance_best_practices`: `{ principles, antiPatterns, citations? }`
- `guidance_phase`: `{ phase, checklist, steps, redFlags, toolSuggestions }`
- `guidance_prompts_catalog`: `{ prompts }`
- `guidance_followups`: `{ followUps }`
- `guidance_prompt_scaffold`: `{ scaffold }`
- `guidance_tools_catalog`: `{ toolGroups, workflow?, examples? }`

### Bulk Operations

#### Pattern E: `{ deleted, summary }`
Used by:
- `bulk_delete_provisional`: `{ caseId, deleted: { hypotheses, testPlans }, summary }`

## Issues Identified

### 1. Missing `caseId` in Top-Level Response
The following tools return resources but don't include `caseId` at the top level:

**Critical (Mutation Tools):**
- `hypothesis_propose` - Returns `{ hypotheses }` without `caseId`
- `hypothesis_update` - Returns `{ hypothesis, case }` without `caseId`
- `hypothesis_remove` - Returns `{ hypothesis, case }` without `caseId`
- `hypothesis_finalize` - Returns `{ hypothesis, case }` without `caseId`
- `test_plan_create` - Returns `{ testPlanId, status }` without `caseId`
- `test_plan_update` - Returns `{ testPlan, case }` without `caseId`
- `test_plan_remove` - Returns `{ testPlan, case }` without `caseId`
- `case_update` - Returns `{ case }` without `caseId`
- `conclusion_finalize` - Returns `{ conclusion }` without `caseId`

**Impact:** Client must extract `caseId` from nested resource or input parameters, leading to inconsistent handling.

### 2. Missing `case` in Mutation Responses
The following tools don't return the updated case object:

- `test_plan_create` - Returns only `{ testPlanId, status }`
- `hypothesis_propose` - Returns only `{ hypotheses }`
- `conclusion_finalize` - Returns only `{ conclusion }`

**Impact:** Client cannot see the updated case state without making a separate `case_get` call.

### 3. Inconsistent Pagination Structure
- `case_get` uses `cursors: { nextObservationCursor }` (nested object)
- `case_list` uses `nextCursor` (top-level field) + `total`

**Impact:** Different pagination handling logic for different list endpoints.

### 4. Resource Naming Inconsistency
- Most tools use singular resource name: `observation`, `hypothesis`, `testPlan`
- But `hypothesis_propose` uses plural: `hypotheses`
- `case_list` uses plural: `cases`

**Impact:** Inconsistent property access patterns.

## Recommended Unified Structure

### Standard Mutation Response (Single Resource)
```typescript
{
  caseId: string;
  [resource]: Resource;
  case: Case;
}
```

Examples:
- `observation_add`: `{ caseId, observation, case }`
- `hypothesis_update`: `{ caseId, hypothesis, case }`
- `test_plan_create`: `{ caseId, testPlan, case }`

### Standard Mutation Response (Multiple Resources)
```typescript
{
  caseId: string;
  [resources]: Resource[];
  case: Case;
}
```

Examples:
- `hypothesis_propose`: `{ caseId, hypotheses, case }`

### Standard Query Response (Single Resource)
```typescript
{
  case: Case;
  cursors?: {
    [cursorName]: string;
  };
}
```

Example:
- `case_get`: `{ case, cursors?: { nextObservationCursor } }`

### Standard Query Response (Multiple Resources)
```typescript
{
  [resources]: Resource[];
  pagination: {
    nextCursor?: string;
    total: number;
  };
}
```

Example:
- `case_list`: `{ cases, pagination: { nextCursor?, total } }`

### Standard Bulk Operation Response
```typescript
{
  caseId: string;
  deleted: {
    [resourceType]: Resource[];
  };
  summary: {
    [resourceType]: number;
  };
}
```

Example:
- `bulk_delete_provisional`: `{ caseId, deleted: { hypotheses, testPlans }, summary: { hypotheses: 2, testPlans: 3 } }`

## Migration Strategy

### Phase 1: Add Missing Fields (Non-Breaking)
1. Add `caseId` to all mutation tools that are missing it
2. Add `case` to mutation tools that return minimal responses
3. Keep existing fields for backward compatibility

### Phase 2: Standardize Pagination (Non-Breaking)
1. `case_list`: Add nested `pagination` object while keeping top-level fields
2. Document migration path

### Phase 3: Breaking Changes (Future Major Version)
1. Remove redundant top-level pagination fields from `case_list`
2. Remove `status` and `notes` from `test_plan_create` (move to `testPlan` object)
3. Unified error envelope structure

## Benefits of Unified Structure

1. **Developer Experience**: Predictable response handling across all tools
2. **Type Safety**: Shared TypeScript interfaces for similar operations
3. **Error Handling**: Consistent patterns for success/failure cases
4. **Documentation**: Single set of patterns to learn
5. **Client Libraries**: Simplified SDK implementation
6. **Token Optimization**: Works well with Issue #7's optimization strategies

## Related Issues

- Issue #7: API response verbosity (token consumption)
- Issue #9: case_get pagination behavior unclear
- Issue #8: This issue (response structure consistency)
