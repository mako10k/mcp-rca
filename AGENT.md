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
| 名前 | 役割 | 主な入力 | 主な出力 |
|------|------|----------|----------|
| `hypothesis/propose` | 仮説案の生成 (LLM 呼び出しは未実装でプレースホルダー応答) | `caseId`, `text`, `rationale?`, `context?`, `logs?` | `hypotheses[]` |
| `test/plan` | 仮説検証手順の作成 | `caseId`, `hypothesisId`, `method`, `expected`, `metric?` | `testPlanId`, `status`, `notes` |
| `test/prioritize` | テスト計画の優先順位決定 (RICE/ICE) | `strategy`, `items[]` | `ranked[]` |
| `conclusion/finalize` | 結論とフォローアップの確定 | `caseId`, `rootCauses[]`, `fix`, `followUps?` | `conclusion` |

すべてのツールは Zod スキーマで検証され、`structuredContent` (JSON) と整形済みテキストを返します。

### リソース
| URI | 説明 |
|-----|------|
| `doc://mcp-rca/README` | プロジェクト README.md の内容 |
| `doc://mcp-rca/AGENT` | 本ドキュメント |
| `doc://mcp-rca/prompts/hypothesis` | 仮説生成プロンプトテンプレート |

`resources/listChanged` 通知に対応済み。`resources/subscribe` は登録のみでイベント送出は今後の拡張です。

## 典型的なワークフロー
1. クライアントが `initialize` を送信すると、サーバはサポートバージョンをネゴシエートし capabilities を返す。
2. `tools/list` で 4 種類のツールが紹介される。
3. 仮説生成 (`hypothesis/propose`) → テスト計画 (`test/plan`) → 優先順位付け (`test/prioritize`) → 結論整理 (`conclusion/finalize`) の順に利用できる。
4. いつでも `resources/read` で補助ドキュメントを取得可能。

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
- ケース管理や観測登録ツールの復活 (`case/create`, `observation/add` 等)
- LLM クライアント統合による仮説生成の実装
- `resources/subscribe` を利用した差分通知
- 結論確定時のメタデータ (信頼度, 署名) 付加

本ファイルを常に最新仕様の単一ソースとして扱い、クライアントやドキュメントから参照すること。*** End Patch
