# AGENT.md — Root Cause Analysis MCP Server

最終更新: 2025-10-16

## 目的
`mcp-rca` はインシデントの原因分析を支援するための Model Context Protocol (MCP) サーバです。LLM が調査を補助できるよう、仮説生成から結論整理までの流れをツールとして提供します。

## 実装概要
- 言語 / ランタイム: TypeScript (ESM) on Node.js 20
- プロトコル実装: `@modelcontextprotocol/sdk` (MCP 2025-06-18)
- トランスポート: stdio (改行区切り JSON Frames)
- エントリーポイント: `dist/server.js`
- 開発用ホットリロード: `npm run dev` (tsx) — MCP クライアント経由では使用しないこと

## 公開機能
### ツール
> **Status Legend**: 実装済み ✅ / 設計済み (未実装) ✳️

| 名前 | 役割 | ステータス | 主な入力 | 主な出力 |
|------|------|-----------|----------|----------|
| `case_create` | 新しい RCA ケースの作成 | ✅ | `title`, `severity`, `tags?` | `caseId`, `case` |
| `case_get` | 単一ケースの詳細取得 (関連オブジェクトに制限付きページング) | ✅ | `caseId`, `include?`, `observationCursor?`, `observationLimit?` | `case`, `cursors?` |
| `case_list` | ケース一覧・検索 (ページング付き) | ✅ | `query?`, `tags?`, `severity?`, `includeArchived?`, `pageSize?`, `cursor?` | `cases[]`, `nextCursor?`, `total?` |
| `case_update` | ケースのメタデータ更新とアーカイブ管理 | ✅ | `caseId`, `title?`, `severity?`, `tags?`, `status?` | `case` |
| `observation_add` | ケースに観測を追加 | ✅ | `caseId`, `what`, `context?` | `caseId`, `observation`, `case` |
| `observation_remove` | ケースから観測を削除 (ソフトデリート) | ✅ | `caseId`, `observationId` | `caseId`, `observation`, `case` |
| `observation_update` | 観測内容の更新 | ✅ | `caseId`, `observationId`, `what?`, `context?` | `caseId`, `observation`, `case` |
| `hypothesis_propose` | 仮説案の生成 (LLM 呼び出しは未実装でプレースホルダー応答) | ✅ | `caseId`, `text`, `rationale?`, `context?`, `logs?` | `hypotheses[]` |
| `hypothesis_update` | 仮説の更新 | ✅ | `caseId`, `hypothesisId`, `text?`, `rationale?`, `confidence?` | `hypothesis`, `case` |
| `hypothesis_remove` | 仮説の削除 (関連テストプランも削除) | ✅ | `caseId`, `hypothesisId` | `hypothesis`, `case` |
| `hypothesis_finalize` | 仮説の本登録化 (confidence を 1.0 に設定) | ✅ | `caseId`, `hypothesisId` | `hypothesis`, `case` |
| `test_plan` | 仮説検証手順の作成 | ✅ | `caseId`, `hypothesisId`, `method`, `expected`, `metric?` | `testPlanId`, `status`, `notes` |
| `test_plan_update` | テストプランの更新 | ✅ | `caseId`, `testPlanId`, `method?`, `expected?`, `metric?`, `priority?` | `testPlan`, `case` |
| `test_plan_remove` | テストプランの削除 | ✅ | `caseId`, `testPlanId` | `testPlan`, `case` |
| `test_prioritize` | テスト計画の優先順位決定 (RICE/ICE) | ✅ | `strategy`, `items[]` | `ranked[]` |
| `bulk_delete_provisional` | 仮登録の一括削除 (confidence/priority 閾値に基づく) | ✅ | `caseId`, `confidenceThreshold?`, `priorityThreshold?` | `deletedHypotheses[]`, `deletedTestPlans[]`, `case` |
| `conclusion_finalize` | 結論とフォローアップの確定 | ✅ | `caseId`, `rootCauses[]`, `fix`, `followUps?` | `conclusion` |

すべてのツールは Zod スキーマで検証され、`structuredContent` (JSON) と整形済みテキストを返します。

### リソース
| URI | 説明 |
|-----|------|
| `doc://mcp-rca/README` | プロジェクト README.md の内容 |
| `doc://mcp-rca/AGENT` | 本ドキュメント |
| `doc://mcp-rca/prompts/hypothesis` | 仮説生成プロンプトテンプレート |

`resources/listChanged` 通知に対応済み。`resources/subscribe` は登録のみでイベント送出は今後の拡張です。

ケースデータは `data/cases.json` に JSON として保存されます。テスト環境などでは `MCP_RCA_CASES_PATH` 環境変数で保存先を上書きできます。
各ケースは `status` (`active` / `archived`) を持ち、`case_update` ツールでアーカイブ切り替えが可能です。

### 典型的なワークフロー
1. クライアントが `initialize` を送信すると、サーバはサポートバージョンをネゴシエートし capabilities を返す。
2. `tools/list` で 17 種類のツールが紹介される。
3. 仮説生成 (`hypothesis_propose`) → テスト計画 (`test_plan`) → 優先順位付け (`test_prioritize`) → 結論整理 (`conclusion_finalize`) の順に利用できる。
4. 仮説やテストプランの更新・削除は `hypothesis_update`, `hypothesis_remove`, `test_plan_update`, `test_plan_remove` で可能。
5. 確信度の高い仮説は `hypothesis_finalize` で本登録化。
6. 不要な仮説・テストプランは `bulk_delete_provisional` で一括削除。
7. いつでも `resources/read` で補助ドキュメントを取得可能。

### ケース管理機能の設計方針
- **ツール数の抑制**: ケース CRUD は `case_create`, `case_get`, `case_list`, `case_update` の 4 本に集約し、削除は `case_update` の `status: "archived"` 指定でソフトデリートとする。
- **`case_get`**: 必須入力は `caseId`。`include` 配列で `observations` を指定した場合のみ観測を返す。観測は `observationCursor`/`observationLimit` (デフォルト 20, 最大 100) でページングし、結果に `cursors.nextObservationCursor?` を付与する。
- **`case_list`**: フィルター (`query` はタイトル/タグ前方一致、`tags` は AND 条件、`severity`, `includeArchived`) とページング (`pageSize` デフォルト 20, 上限 50)。`cursor` は `base64(JSON.stringify({ offset, filtersHash }))` 形式とし、結果に `nextCursor` と `total` (最大 1000 件までカウント) を含める。
- **`case_update`**: 任意フィールドのみ更新。`status` は `active` / `archived` を想定し、アーカイブ済みケースは `case_list` の既定値で非表示。
- **観測の扱い**: CRUD の C にあたる `observation_add` を継続採用。観測の一覧取得は `case_get` のページング機能で対応し、個別更新・削除は今後必要になった際に検討する。
- **整合性**: `case_update` 実行後は `updatedAt` を更新し、キャッシュ整合性のため `case_listChanged` 通知を検討 (未実装)。

## 開発・運用メモ
- ビルド: `npm run build`
- MCP サーバ起動: `npm run start` または `node dist/server.js`
- テスト: `npm run test` (Vitest)
- 型チェック: `npm run typecheck`
- MCP クライアントからは **必ずビルド済みバンドル** を実行する。`npm run dev` を使うと `tsx` が STDOUT にログを出し、クライアントが JSON を解釈できなくなる。

## ロギング / エラーハンドリング
- ツール実行時は JSON 形式の構造化ログを `stderr` に出力 (level, tool, requestId, message を含む)。
- SDK 経由で `tools/listChanged` / `resources/listChanged` 通知を送信。
- 現在は永続化やケース管理ツールは実装されていない。

## 今後の拡張候補
- ケースノート等の追加機能
- LLM クライアント統合による仮説生成の実装
- `resources/subscribe` を利用した差分通知
- 結論確定時のメタデータ (信頼度, 署名) 付加

本ファイルを常に最新仕様の単一ソースとして扱い、クライアントやドキュメントから参照すること。*** End Patch
