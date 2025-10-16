# 🧠 AGENT.md — Root Cause Analysis Agent (`mcp-rca`)

## 🎯 Purpose
このエージェントは、**事象の原因特定・仮説検証・再発防止策策定**を支援するための MCP (Model Context Protocol) サーバです。  
LLM による思考補助を安全に行うことを目的とし、以下の構造化フェーズを自動化します。

| フェーズ | 概要 |
|----------|------|
| 事象 (Observation) | 何が起きたのかを記録 |
| 影響 (Impact) | どの範囲にどんな影響が出たか |
| 原因仮説 (Hypothesis) | 想定される原因候補 |
| 仮説立証案 (Test Plan) | どう検証するか |
| 優先順位 (Prioritization) | どの仮説から検証するか |
| 対応結果 (Test Result) | 実際に得られた結果 |
| 総合判定 (Conclusion) | 原因の確定と再発防止策 |

---

## 🧩 Architecture Overview

```mermaid
graph TD
  A[client: Copilot / ChatGPT / MCP UI] -->|tools/list| B[mcp-rca server]
  B --> C[case:create / observation:add / hypothesis:propose ...]
  B --> D[resources:list/read (case://, doc://)]
  D --> E[PostgreSQL / JSONB store]
  B --> F[LLM helper: HypothesisGenerator / PostmortemWriter]
```

---

## ⚙️ Capabilities Declaration

```jsonc
{
  "name": "mcp-rca",
  "version": "0.1.0",
  "capabilities": {
    "tools": { "listChanged": true },
    "resources": { "subscribe": true, "listChanged": true }
  }
}
```

---

## 🧠 Core Tools

| Tool | Purpose | Input | Output |
|------|----------|--------|--------|
| `case/create` | RCAケース作成 | `title`, `severity`, `tags` | `caseId` |
| `observation/add` | 事象登録 | `caseId`, `what`, `context` | `observationId` |
| `impact/set` | 影響定義 | `metric`, `value`, `scope` | updated |
| `hypothesis/propose` | 原因仮説提案 (LLM支援) | `text`, `rationale` | `hypothesisId` |
| `test/plan` | 仮説立証案作成 | `method`, `expected`, `metric` | `testId` |
| `test/prioritize` | 優先順位決定 (RICE/ICE) | `method`, `items` | ranked list |
| `test/record_result` | 検証結果記録 | `testId`, `observed`, `metrics` | updated |
| `conclusion/finalize` | 総合判定 | `rootCauses`, `fix`, `followUps` | closed status |
| `postmortem/generate` | ふりかえり生成 (5Whys + 魚骨) | `caseId`, `template` | `doc://postmortem/{id}.md` |

---

## 🧾 Data Model

```ts
Case {
  id: string;
  title: string;
  severity: "SEV1"|"SEV2"|"SEV3";
  tags: string[];
  observations: Observation[];
  impacts: Impact[];
  hypotheses: Hypothesis[];
  tests: TestPlan[];
  results: TestResult[];
  conclusion?: Conclusion;
  createdAt: string;
  updatedAt: string;
}
```

---

## 💬 LLM Prompt Templates

### `hypothesis/propose`
> あなたはSREチームの分析担当です。以下の観測データ・影響・ログから  
> 反証可能な原因仮説を最大3件提案してください。  
> 各仮説には立証方法・期待される観測結果をJSONで添えてください。

### `postmortem/generate`
> RCA結果をもとに再発防止レポートを生成。  
> 含める要素：概要 / 発生要因（5 Whys）/ 対策 / 教訓。

---

## 🧮 Prioritization Logic

| 指標 | 計算式 | 特徴 |
|------|--------|------|
| RICE | (Reach × Impact × Confidence) / Effort | 数量的優先順位付け |
| ICE | Impact × Confidence × Ease | 簡易・直感的評価 |

---

## 🔐 Trust & Safety

- Human-in-the-loop：ツール呼び出し前にユーザー確認を必須化  
- 最小権限原則：I/O 分離（DB, File, Network のツール分離）  
- 署名済みビルド：npm lockfile & source hash 検証  
- 信頼度マーカー出力：🟢🔵🟡🔴 を各結果に付与  

---

## 🧩 Integration Examples

### ChatGPT / Copilot
```bash
/tools/call
{
  "name": "hypothesis/propose",
  "arguments": {
    "caseId": "c_102",
    "context": "PCSが夜間に自動停止",
    "logs": ["inverter error 503"]
  }
}
```

### CLI
```bash
mcp-cli call hypothesis/propose --case c_102 --context "..." --logs error.log
```

---

## 🧭 Suggested Directory Layout

```
mcp-rca/
 ├─ src/
 │   ├─ server.ts
 │   ├─ tools/
 │   │   ├─ hypothesis.ts
 │   │   ├─ test_plan.ts
 │   │   ├─ prioritize.ts
 │   │   └─ conclusion.ts
 │   ├─ schema/
 │   │   ├─ case.ts
 │   │   ├─ hypothesis.ts
 │   │   └─ result.ts
 │   └─ llm/
 │       ├─ prompts/
 │       │   └─ hypothesis.md
 │       └─ generator.ts
 ├─ data/
 │   └─ cases.sqlite
 ├─ package.json
 ├─ README.md
 └─ AGENT.md
```

---

## 🚀 Future Roadmap
- [ ] Bayesian confidence update (`confidenceHistory`)
- [ ] `resources/subscribe` for metrics auto-tracking
- [ ] RCA graph visualization (DAG of cause/effect)
- [ ] Elicitation loop (`dialog/ask_missing_info`)
- [ ] GitOps連携（postmortemをPRとして出力）

---

## 🧭 Maintainer Notes
- Framework: `mcp-server-kit` (Node.js)
- Model: OpenAI GPT-5 or compatible LLM
- License: MIT / Proprietary selectable
- Versioning: Semantic Release via GitHub Actions
