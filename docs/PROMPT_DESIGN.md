# RCA Prompt-Based Assistance Design

## 概要

MCP-RCAは、MCPプロトコルの「プロンプト」「リソース」「ツール」機能を活用し、RCAプロセスを体系的かつ実践的に支援します。

### 設計方針

1. **プロンプト**: LLMへの入力テンプレート（例: 仮説生成、観測要約、次のアクション提案）
2. **リソース**: ガイダンス・ベストプラクティス・チェックリスト等の参照情報
3. **ツール**: RCAケース・観測・仮説・検証・結論などの操作API

ユーザーは、プロンプトでLLMに質問・指示し、リソースで知識を補い、ツールでデータ操作を行うことで、RCAを段階的に進めます。

---

## 命名規則（一般）

一貫性と可読性のため、以下の命名規則を採用します。

- プロンプト名: 小文字のスネークケース。カテゴリ接頭辞は任意だが本プロジェクトでは `rca_` を推奨。
  - 例: `rca_start_investigation`, `rca_next_step`, `rca_hypothesis_guide`, `rca_verification_planning`, `rca_conclusion_guide`
- ツール名: 小文字のスネークケース（既存実装に準拠）。
  - 例: `case_create`, `observation_add`, `hypothesis_propose`, `test_plan`, `conclusion_finalize`, `guidance_best_practices`
- リソース名: 小文字のスネークケース。URIは `doc://mcp-rca/...` でスラッシュ区切り。
  - 例（name）: `rca_best_practices`, `rca_guide`
  - 例（uri）: `doc://mcp-rca/best-practices`, `doc://mcp-rca/guide/checklist`
- 引数/JSONフィールド: lowerCamelCase（既存の `caseId`, `hypothesisId` 等に準拠）。
  - 例: `caseId`, `currentPhase`, `followUps`
- 予約禁止: ドット区切り（`rca.next_step` など）は使用しない（クライアント実装間の互換性のため）。

この規則により、UI上のスラッシュコマンド化・自動補完・ドキュメント検索の一貫性が向上します。

---

## MCPプロンプト設計

MCPのプロンプトは「LLMへの入力テンプレート」として設計します。各プロンプトは、

- name: 一意の識別子（例: rca.hypothesis_propose）
- description: 用途説明
- arguments: 必要な引数（例: caseId, observationSummary）
- messages: LLMに渡す構造化メッセージ（role: user/assistant, content: text等）

### 例: 仮説生成プロンプト

```json
{
  "name": "rca_hypothesis_propose",
  "description": "観測事実から根本原因の仮説を生成する",
  "arguments": [
    { "name": "caseId", "required": true },
    { "name": "observationSummary", "required": false }
  ],
  "messages": [
    {
      "role": "user",
      "content": {
        "type": "text",
        "text": "以下の観測事実から、根本原因の仮説を3つ提案してください。\n\n観測: {{observationSummary}}"
      }
    }
  ]
}
```

### 例: 次のステップ提案プロンプト

```json
{
  "name": "rca_next_step",
  "description": "ケースの進捗に応じて次のアクションを提案する",
  "arguments": [
    { "name": "caseId", "required": true },
    { "name": "currentPhase", "required": false }
  ],
  "messages": [
    {
      "role": "user",
      "content": {
        "type": "text",
        "text": "RCAケースの進捗は以下です。\n\nフェーズ: {{currentPhase}}\n観測数: {{observationCount}}\n仮説数: {{hypothesisCount}}\nテスト計画数: {{testPlanCount}}\n\n次に取るべきアクションを簡潔に提案してください。"
      }
    }
  ]
}
```

---

## MCPリソース設計

ガイダンスやベストプラクティスは「リソース」として提供します。

- name: rca.guide, rca.checklist, rca.best_practices など
- mimeType: text/markdown, text/plain, application/json など
- 内容: RCAの進め方、チェックリスト、よくある落とし穴、参考資料等

### 例: ベストプラクティスリソース

```json
{
  "uri": "resource://rca/best_practices",
  "name": "rca.best_practices",
  "mimeType": "text/markdown",
  "text": "## RCAベストプラクティス\n- 事実ベースで進める\n- 偏見を避ける\n- 系統的に掘り下げる\n- チームで協力する\n..."
}
```

---

## MCPツール設計

RCAの各操作は「ツール」としてAPI化されています。

- case_create, observation_add, hypothesis_propose, test_plan, conclusion_finalize など
- 各ツールはパラメータと戻り値を持つ

### 例: 仮説生成ツール

```json
{
  "name": "hypothesis_propose",
  "params": {
    "caseId": "string",
    "text": "string"
  },
  "result": {
    "hypotheses": [ ... ]
  }
}
```

---

## ユーザープロンプトとLLMの橋渡し設計

目的:「LLMがユーザー向けプロンプトの存在を理解し、適切なタイミングでユーザーに選択を促し、その選択（キー）をトリガーにLLMが必要なツールを実行する」流れを標準化します。

### A. プロンプト可視化をLLMが理解するためのカタログ（ツール）

- ツール名（設計）: guidance_prompts_catalog
- 用途: MCPの prompts/list に相当するメタデータを、LLM向けに要約・意図付きで返す
- 入力: { locale?: string }
- 出力（例）:
  {
    "prompts": [
      {
        "name": "rca_start_investigation",
        "title": "調査開始",
        "description": "新規ケース作成と初期観測の収集を案内",
        "whenToUse": ["インシデント発生直後", "ケース未作成"],
        "arguments": [
          {"name": "incidentSummary", "required": false, "hint": "1-2行"}
        ]
      },
      {
        "name": "rca_next_step",
        "title": "次のアクション提案",
        "description": "現在のケース状態から次の一手を簡潔に提案",
        "whenToUse": ["方針が分からない", "進捗確認"],
        "arguments": [
          {"name": "caseId", "required": true},
          {"name": "currentPhase", "required": false}
        ]
      }
    ]
  }

備考: 実体はサーバーが管理するプロンプト一覧（prompts）を反映し、LLMがユーザーに勧めやすいよう「whenToUse/hint」を付与します。

### B. LLM→ユーザーへの促し（インタラクション契約）

LLMはプロンプトの利用をユーザーへ提案する際、以下の「最小キー」を返します。クライアントはこれを検出して、ユーザーUIでワンクリック誘導（slashコマンド等）を表示します。

- suggestedPrompt: {
  name: string;             // 例: "rca.next_step"
  arguments?: object;       // 例: { caseId: "case_xxx" }
  rationale?: string;       // 提案理由（短文）
}

フォールバック: クライアントが自動起動に対応しない場合は、LLMが自然言語で「/rca_next_step を選択してください」等、手動手順を提示します。

### C. ユーザー選択→ツール実行への手順ゲーティング

1) ユーザーがプロンプトを選択（prompts/get→messages注入）
2) 以降のターンで、LLMは必要に応じて guidance_* ツール（LLM向けガイダンス）を呼ぶ
3) 操作が必要なら、RCAツール群（case_*, observation_*, hypothesis_*, test_plan_*, conclusion_*）を呼ぶ

安全策（設計）:
- ゲートキー: クライアントは「suggestedPromptがユーザーにより承認された」事実を会話メタに設定
- サーバー側は「承認済みフラグ不在時は破壊的ツール（削除等）を拒否」等のポリシーを実装可能

### D. 例（要旨）

1. LLMがプロンプト候補を提示

```
assistant (structuredContent): {
  "suggestedPrompt": {
    "name": "rca_next_step",
    "arguments": { "caseId": "case_123" },
    "rationale": "観測は十分、次は優先度付きの検証計画が必要です"
  }
}
```

2. ユーザーがUIで rca.next_step を選択 → prompts/get でmessages挿入

3. 次ターンでLLMが guidance_phase(phase="testing") を呼び、その結果を踏まえて `test_plan` を最小限だけ実行提案

---

## LLM向けガイダンス設計（ツール）

ユーザー向けの参照情報は「リソース」で提供しつつ、LLMが思考・出力の質を安定化させるためのガイダンスは「ツール」で供給します。プロンプトは「最初にガイダンスツールを呼んでから推論する」ようにLLMへ誘導します。

重要: MCPのプロンプト自体はツール実行を内包しません。クライアントが「プロンプトの指示に従ってツールを呼ぶ」か、LLMがツール呼び出しを要求し、クライアントがそれを実行する前提です。

### 目的

- LLMに対して、フェーズ別の進め方、チェックリスト、アンチパターン、次の一手を定型化して供給
- 出力の「ばらつき」を抑え、安全な手順・用語・フォーマットを強制
- 将来のベストプラクティス更新を「ツールのレスポンス更新」で一括反映

### ツール一覧（設計）

1) guidance_best_practices
- 用途: RCA全体の原則・アンチパターン・用語をLLM向けに返す
- 入力: { locale?: string }
- 出力: {
  systemPreamble: string,      // system相当の前置き
  heuristics: string[],        // 判断の指針
  antiPatterns: string[],      // やってはいけないこと
  citations?: string[]         // 参考
}

2) guidance_phase
- 用途: フェーズ別の行動指針・チェックリストを返す
- 入力: { phase: "observation"|"hypothesis"|"testing"|"conclusion", level?: "basic"|"advanced" }
- 出力: {
  steps: string[],             // 推奨手順（箇条書き）
  checklists: string[],        // チェック項目
  redFlags: string[],          // 典型的な落とし穴
  toolHints: string[]          // 使うべきツール名と意図
}

3) guidance_prompt_scaffold
- 用途: LLMに与えるべきプロンプト雛形（役割宣言、出力フォーマット、制約）
- 入力: { task: "hypothesis"|"verification_plan"|"next_step"|"conclusion", strictness?: number }
- 出力: {
  role: string,                // あなたは○○の専門家…
  format: string,              // 出力フォーマット例
  constraints: string[],       // 守るべき制約
  examples?: string[]          // サンプル
}

4) guidance_followups
- 用途: 結論後のフォローアップ（再発防止・文書化・監視）
- 入力: { domain?: string[] }
- 出力: { actions: string[], ownersHint?: string }

出力は「LLMがそのままシステム/ユーザメッセージとして利用できる短い断片」を想定します（長文ドキュメントはリソースへ）。

### プロンプトからの誘導パターン

2つの実装パターンを想定します。

- Pull（推奨）: プロンプトの先頭で「まず guidance_* ツールを呼び、内容を反映せよ」とLLMに指示。
- Embed: クライアントが先に guidance_* を呼び、その結果をプロンプトのmessagesに埋め込む。

#### Pull例: rca.next_step

prompts/get が返すメッセージ（要旨）:

```
role: user
text: |
  次の手順で回答してください。
  1) guidance_phase を phase={{currentPhase}} で実行して要約を取り込み、
  2) その指針に従って、次に取るべき具体アクションを3件以内で提案。
  入出力は簡潔に。不要な前置きは省略してください。
  ケース要約: 観測={{observationCount}} 仮説={{hypothesisCount}} テスト={{testPlanCount}}
```

#### Embed例: rca_hypothesis_propose

クライアント側で guidance_prompt_scaffold(task="hypothesis") を呼び、結果を1つの先頭メッセージとして埋め込み、その後に観測サマリと出力要求を続ける。

---

## ユーザー体験フロー（実践例）

1. **ケース作成**: case_create で新規RCAケースを作成
2. **観測記録**: observation_add で事実を記録
3. **仮説生成**:
  - Pull: rca_hypothesis_propose の指示に従い、LLMが guidance_prompt_scaffold(task="hypothesis") を呼ぶ
  - Embed: クライアントが guidance_prompt_scaffold を事前取得してmessagesへ埋め込み
  - そのうえで LLM に仮説を提案させる
4. **検証計画**: test_plan で仮説の検証方法を登録
5. **結論記録**: conclusion_finalize で根本原因・修正・フォローアップを記録
6. **ガイダンス参照**: resources/get rca.guide, rca.best_practices で知識を補う

---

## 実装計画

1. プロンプト定義（src/prompts/rca-*.ts）
2. リソース定義（src/resources/rca-*.md）
3. ツールAPI（src/tools/）
4. UI/CLIでプロンプト・リソース・ツールを組み合わせて利用

---

## まとめ

MCP-RCAは、プロンプト（LLM入力）、リソース（知識）、ツール（操作API）を組み合わせ、実践的かつ体系的なRCA解析を支援します。ユーザーは状況に応じてプロンプトでLLMに質問し、リソースで学び、ツールでデータ操作を行うことで、迷わずRCAを進められます。

### 2. プロンプト一覧

#### 2.1 プロセスガイダンス系プロンプト

##### `rca/start-investigation`
**用途**: 新しい RCA ケースの開始時に必要な情報を収集

**引数**:
- `incidentSummary` (optional): インシデントの簡単な説明

**出力テンプレート**:
```
あなたは Root Cause Analysis (RCA) の専門家です。以下のステップでインシデントの調査を開始しましょう。

## 現在の状況
{{incidentSummary}}

## 次のステップ

1. **ケース作成** - まず RCA ケースを作成します
   - インシデントのタイトルを決めてください（簡潔で具体的に）
   - 重大度を評価してください (SEV1: サービス停止, SEV2: 機能劣化, SEV3: 軽微)
   - 関連タグを追加してください（例: database, api, performance）

2. **初期観測の記録** - 何が起きたかを記録します
   - いつ問題が発生しましたか？
   - どのような症状が観測されましたか？
   - 影響範囲はどこですか？
   - 関連するメトリクス、ログ、エラーメッセージは？

## 推奨ツール

- `case_create`: 新しいケースを作成
- `observation_add`: 観測事実を記録

## ヒント

- 観測は**事実のみ**を記録し、推測や解釈は避けてください
- タイムスタンプや具体的な数値を含めると後の分析に役立ちます
- git branch/commit や deploy 環境情報を記録すると追跡が容易になります
```

##### `rca/next-step`
**用途**: 現在のケース状態に基づいて次に取るべきアクションを提案

**引数**:
- `caseId` (required): 対象ケースの ID
- `currentPhase` (optional): 現在のフェーズ (observation/hypothesis/testing/conclusion)

**出力テンプレート**:
```
## ケース進捗分析

**ケース ID**: {{caseId}}
**現在のフェーズ**: {{currentPhase}}

### 現在の状態

- 観測: {{observationCount}} 件
- 仮説: {{hypothesisCount}} 件 (確信度 > 0.7: {{highConfidenceCount}} 件)
- テスト計画: {{testPlanCount}} 件
- 結論: {{hasConclusion}}

### 推奨される次のアクション

{{#if needMoreObservations}}
**さらに観測を追加**

現在の観測が少ないため、以下の情報を追加で収集することをお勧めします:
- システムメトリクス（CPU, メモリ, ディスク I/O）
- エラーログの詳細
- タイムライン（問題発生前後の変更）
- 外部依存サービスの状態

ツール: `observation_add`
{{/if}}

{{#if needHypotheses}}
**仮説の生成**

十分な観測が集まりました。次は根本原因の仮説を立てましょう:
1. 観測された症状から考えられる原因は？
2. 最近の変更やデプロイはありましたか？
3. 外部要因（負荷増加、依存サービス）の可能性は？

ツール: `hypothesis_propose` (LLM 支援で自動生成)
{{/if}}

{{#if needTestPlans}}
**検証計画の作成**

仮説 {{topHypothesisId}} ({{topHypothesisText}}) の検証方法を定義しましょう:
- どのようなテストで仮説を確認できますか？
- 期待される結果は？
- 測定すべきメトリクスは？

ツール: `test_plan`, `test_plan_update`
{{/if}}

{{#if readyForConclusion}}
**結論のまとめ**

十分な検証が完了しました。以下をまとめて結論を記録しましょう:
- 確定した根本原因
- 実施した修正内容
- 再発防止のためのフォローアップ

ツール: `conclusion_finalize`
{{/if}}

### 追加のヒント

{{contextualHints}}
```

##### `rca/generate-hypotheses-guide`
**用途**: 効果的な仮説を立てるためのガイダンス

**引数**:
- `caseId` (required): 対象ケースの ID
- `observationSummary` (optional): 観測のサマリ

**出力テンプレート**:
```
## 仮説生成ガイド

### 良い仮説の条件

1. **テスト可能**: 検証方法が明確である
2. **具体的**: 曖昧な表現を避け、具体的なコンポーネントや動作を指す
3. **観測と一致**: 記録された観測事実と矛盾しない
4. **実現可能性**: 技術的に起こり得るシナリオである

### 仮説の種類

#### コード・設定の問題
- バグの混入
- 設定ミス
- デプロイの失敗
- 互換性の問題

#### リソースの問題
- メモリリーク
- ディスク容量不足
- CPU 飽和
- ネットワーク帯域の枯渇

#### 外部要因
- 依存サービスの障害
- 予期しない負荷増加
- DDoS 攻撃
- サードパーティ API の変更

### 現在のケースの観測

{{observationSummary}}

### 推奨される仮説生成アプローチ

1. **タイムライン分析**: 問題発生前後の変更を確認
2. **差分分析**: 正常時と異常時の違いを特定
3. **5 Whys**: 「なぜ？」を繰り返して深掘り
4. **類似事例**: 過去の似たようなインシデントを参照

### ツールの使用

```
# LLM に仮説を生成させる（推奨）
hypothesis_propose caseId={{caseId}}

# 手動で仮説を追加する場合
# 各仮説について text, rationale, confidence (0-1) を指定
```

### 次のステップ

仮説を立てたら:
1. 各仮説の検証方法（テスト計画）を定義
2. 優先順位を付けて検証を実施
3. 結果に基づいて仮説の信頼度を更新
```

##### `rca/verification-planning`
**用途**: テスト計画の作成を支援

**引数**:
- `caseId` (required): 対象ケースの ID
- `hypothesisId` (required): 検証する仮説の ID
- `hypothesisText` (required): 仮説の内容

**出力テンプレート**:
```
## 検証計画の作成

### 対象仮説
{{hypothesisText}}

### 効果的なテスト計画の要素

1. **検証方法 (method)**
   - 何をどのように調査/テストするか
   - 使用するツールやコマンド
   - 実行環境

2. **期待される結果 (expected)**
   - 仮説が正しい場合に観測されるべき結果
   - 具体的な数値や状態

3. **測定メトリクス (metric)**
   - 定量的な判断基準
   - しきい値

### テスト計画のテンプレート

#### ログ調査系
```
method: "grep ERROR /var/log/app.log | grep '{{timestamp}}'"
expected: "特定のエラーパターンが見つかる"
metric: "error_count > 100"
```

#### メトリクス確認系
```
method: "Prometheus で memory_usage を確認"
expected: "メモリ使用率が 95% を超えている"
metric: "memory_usage_percent"
```

#### 再現テスト系
```
method: "負荷テストツールで同条件を再現"
expected: "同様のエラーが発生する"
metric: "error_rate"
```

#### コード解析系
```
method: "git diff {{commit_before}}..{{commit_after}} でコード変更を確認"
expected: "問題のある変更が含まれている"
metric: "changed_lines"
```

### 優先順位付け

テスト計画には priority を設定できます:
- 1-2: 高優先度（実施コストが低く、効果が高い）
- 3-5: 中優先度
- 6-10: 低優先度（時間がかかる、影響が小さい）

### ツールの使用

```
test_plan caseId={{caseId}} hypothesisId={{hypothesisId}} \
  method="..." expected="..." metric="..." priority=1
```

### RICE スコアリング

複数のテスト計画がある場合、優先順位付けに役立ちます:

```
test_prioritize strategy=RICE items=[
  {id: "tp_1", reach: 10, impact: 3, confidence: 0.8, effort: 2},
  {id: "tp_2", reach: 5, impact: 2, confidence: 0.6, effort: 1}
]
```

- Reach: 影響範囲
- Impact: インパクト
- Confidence: 確信度
- Effort: 実施コスト
```

##### `rca/conclusion-guide`
**用途**: 結論をまとめる際のガイダンス

**引数**:
- `caseId` (required): 対象ケースの ID

**出力テンプレート**:
```
## RCA 結論のまとめ

### 結論に含めるべき要素

#### 1. 根本原因 (rootCauses)
確定した根本原因のリスト:
- 技術的な原因を明確に記述
- 「なぜそれが起きたか」まで深掘り
- 複数の原因がある場合はすべて列挙

例:
- "データベース接続プールの最大接続数が不足していた"
- "メモリリークを引き起こすコードが最新デプロイに含まれていた"

#### 2. 実施した修正 (fix)
問題を解決するために行った対応:
- 緊急対応（ロールバック、スケールアップなど）
- 恒久対策（コード修正、設定変更など）
- 適用したタイミングと確認方法

#### 3. フォローアップアクション (followUps)
再発防止のための今後のアクション:
- 監視・アラートの追加
- ドキュメント・ランブックの更新
- アーキテクチャの改善
- テストの追加

### チェックリスト

結論を記録する前に確認:

- [ ] 根本原因が明確で、なぜそれが起きたか説明できる
- [ ] 実施した修正で問題が解決したことを確認した
- [ ] 同じ問題が再発しないための対策を定義した
- [ ] 関係者に共有すべき学びがある
- [ ] 必要なドキュメントの更新を特定した

### 例

```json
{
  "rootCauses": [
    "データベース接続プールサイズ (50) がピーク時のリクエスト数 (200 req/s) に対して不足",
    "接続タイムアウト設定が短すぎた (1秒) ため、再試行が即座に失敗"
  ],
  "fix": "接続プール最大数を 200 に増加、タイムアウトを 5 秒に延長。19:30 にデプロイし、エラー率が 0% になったことを確認。",
  "followUps": [
    "データベース接続数のダッシュボードを作成",
    "接続プール枯渇時のアラートを追加",
    "負荷テスト環境で定期的にキャパシティテストを実施",
    "接続プール設定のベストプラクティスをドキュメント化"
  ]
}
```

### ツールの使用

```
conclusion_finalize caseId={{caseId}} \
  rootCauses=["原因1", "原因2"] \
  fix="実施した修正内容" \
  followUps=["フォローアップ1", "フォローアップ2"]
```

### 完了後

結論を記録すると、ケースのステータスが `closed` に更新されます。
チームメンバーと共有し、学びを組織全体に広げましょう。
```

#### 2.2 ベストプラクティス系プロンプト

##### `rca/best-practices`
**用途**: RCA 全般のベストプラクティスを提供

**出力テンプレート**:
```
## RCA ベストプラクティス

### 調査の原則

#### 1. 事実ベースで進める
- **観測**: 客観的な事実のみを記録（ログ、メトリクス、タイムスタンプ）
- **仮説**: 推測であることを明示し、確信度を付ける
- **検証**: データで裏付けを取る

#### 2. 偏見を避ける
- 最初の仮説に固執しない
- 複数の可能性を並行して検討
- 反証も積極的に探す

#### 3. 系統的に進める
- 表面的な原因で止まらず、根本原因まで掘り下げる
- 5 Whys テクニックの活用
- タイムラインの構築

#### 4. 協力して解決する
- 関連チームを巻き込む
- 知識を共有する
- ブレイムレスな文化

### フェーズ別のポイント

#### 観測フェーズ
- タイムスタンプを必ず記録
- 定量的なデータを優先
- 関連する変更（デプロイ、設定変更）を確認
- Before/After の比較

#### 仮説フェーズ
- 技術的に妥当な仮説を立てる
- 検証可能な形で定義
- 優先順位を付ける（確率 × 影響度）

#### 検証フェーズ
- 再現性の確認
- A/B 比較
- ログ・メトリクスでの裏付け

#### 結論フェーズ
- 根本原因の特定（表面的でない）
- 恒久対策の定義
- 再発防止策の実施

### よくある落とし穴

1. **早すぎる結論**: 十分な証拠がない段階で原因を決めつける
2. **表面的な原因で満足**: 「なぜ」を繰り返さない
3. **文書化の不足**: 調査過程を記録しない
4. **フォローアップの欠如**: 根本対策を実施しない

### このツールの効果的な使い方

1. `rca/start-investigation` で調査を開始
2. 各フェーズで `rca/next-step` を実行して進捗確認
3. 迷ったら専門的なガイド（`rca/generate-hypotheses-guide` など）を参照
4. `conclusion_finalize` で完了

### 参考資料

- Google SRE Book: Postmortem Culture
- AWS Well-Architected Framework: Operational Excellence
- Microsoft Azure: Incident Response
```

#### 2.3 メタ・ヘルプ系プロンプト

##### `rca/help`
**用途**: 利用可能なプロンプトとツールの一覧を提供

**出力テンプレート**:
```
## MCP-RCA ヘルプ

### 利用可能なプロンプト

#### プロセスガイダンス
- `rca/start-investigation` - 新しい調査の開始
- `rca/next-step` - 次に取るべきアクション
- `rca/generate-hypotheses-guide` - 仮説生成のガイド
- `rca/verification-planning` - テスト計画の作成支援
- `rca/conclusion-guide` - 結論のまとめ方

#### ベストプラクティス
- `rca/best-practices` - RCA 全般のベストプラクティス

#### ヘルプ・参照
- `rca/help` - このヘルプ（現在表示中）
- `rca/tool-reference` - 利用可能なツールのリファレンス

### 利用可能なツール

#### ケース管理
- `case_create` - 新しいケースを作成
- `case_get` - ケース情報を取得
- `case_list` - ケース一覧を取得
- `case_update` - ケース情報を更新

#### 観測
- `observation_add` - 観測を追加
- `observation_update` - 観測を更新
- `observation_remove` - 観測を削除

#### 仮説
- `hypothesis_propose` - 仮説を生成（LLM 支援）
- `hypothesis_update` - 仮説を更新
- `hypothesis_remove` - 仮説を削除
- `hypothesis_finalize` - 仮説を確定（信頼度 1.0）

#### テスト計画
- `test_plan` - テスト計画を作成
- `test_plan_update` - テスト計画を更新
- `test_plan_remove` - テスト計画を削除
- `test_prioritize` - テスト計画の優先順位付け

#### 結論
- `conclusion_finalize` - RCA を完了し結論を記録

#### ユーティリティ
- `bulk_delete_provisional` - 低信頼度の仮説/計画を一括削除

### 使い方の例

#### 1. 新しいインシデントの調査開始
```
1. プロンプト: rca/start-investigation incidentSummary="API レスポンスタイムが 10 倍に増加"
2. ガイダンスに従ってケース作成: case_create title="API レスポンス遅延" severity=SEV1
3. 観測を記録: observation_add caseId=case_xxx what="レスポンスタイム 100ms → 1000ms"
```

#### 2. 次のステップが分からないとき
```
rca/next-step caseId=case_xxx
→ 現在の進捗に基づいた推奨アクションが表示される
```

#### 3. 仮説を立てたい
```
1. プロンプト: rca/generate-hypotheses-guide caseId=case_xxx
2. LLM に生成させる: hypothesis_propose caseId=case_xxx
```

### リソース

- `doc://mcp-rca/README` - プロジェクト概要
- `doc://mcp-rca/AGENT` - 詳細な仕様
- `doc://mcp-rca/prompts/hypothesis` - 仮説生成プロンプトテンプレート

### サポート

GitHub Issues: https://github.com/mako10k/mcp-rca/issues
```

##### `rca/tool-reference`
**用途**: 全ツールの詳細リファレンス

**出力テンプレート**:
```
## ツールリファレンス

### case_create

新しい RCA ケースを作成します。

**パラメータ**:
- `title` (string, required): ケースのタイトル
- `severity` (enum, required): SEV1 | SEV2 | SEV3
- `tags` (string[], optional): タグのリスト
- `gitBranch` (string, optional): 関連する git ブランチ
- `gitCommit` (string, optional): 関連する git コミット
- `deployEnv` (string, optional): デプロイ環境

**戻り値**:
- `caseId`: 作成されたケースの ID
- `case`: ケースの詳細情報

**例**:
```json
{
  "title": "データベース接続タイムアウト増加",
  "severity": "SEV2",
  "tags": ["database", "performance"],
  "gitBranch": "main",
  "deployEnv": "production"
}
```

---

### observation_add

ケースに観測事実を追加します。

**パラメータ**:
- `caseId` (string, required): 対象ケースの ID
- `what` (string, required): 観測内容
- `context` (string, optional): 追加コンテキスト
- `gitBranch` (string, optional): 関連 git ブランチ
- `gitCommit` (string, optional): 関連 git コミット
- `deployEnv` (string, optional): デプロイ環境

**戻り値**:
- `observation`: 追加された観測
- `case`: 更新されたケース

**ベストプラクティス**:
- 事実のみを記録（推測は含めない）
- タイムスタンプを含める
- 定量的なデータを優先

---

### hypothesis_propose

LLM を使用して仮説を生成します。

**パラメータ**:
- `caseId` (string, required): 対象ケースの ID
- `text` (string, optional): 追加コンテキスト
- `context` (string, optional): 追加コンテキスト
- `logs` (string, optional): ログの抜粋

**戻り値**:
- `hypotheses`: 生成された仮説のリスト
  - 各仮説には `id`, `text`, `rationale`, `confidence` が含まれる
  - オプションで `testPlan` が含まれることもある

**注意**:
- 複数の仮説が生成される可能性がある
- 信頼度 (confidence) は 0-1 の範囲

---

### test_plan

仮説の検証計画を作成します。

**パラメータ**:
- `caseId` (string, required): 対象ケースの ID
- `hypothesisId` (string, required): 対象仮説の ID
- `method` (string, required): 検証方法
- `expected` (string, required): 期待される結果
- `metric` (string, optional): 測定メトリクス
- `priority` (number, optional): 優先度 (1-10)
- `gitBranch`, `gitCommit`, `deployEnv` (optional): メタデータ

**戻り値**:
- `testPlanId`: 作成されたテスト計画の ID
- `testPlan`: テスト計画の詳細

---

### test_prioritize

複数のテスト計画を RICE または ICE スコアで優先順位付けします。

**パラメータ**:
- `strategy` (enum, required): "RICE" | "ICE"
- `items` (array, required): 優先順位付けする項目
  - RICE: `reach`, `impact`, `confidence`, `effort`
  - ICE: `impact`, `confidence`, `effort`

**戻り値**:
- `ranked`: スコア順にソートされた項目リスト

---

### conclusion_finalize

RCA を完了し、結論を記録します。

**パラメータ**:
- `caseId` (string, required): 対象ケースの ID
- `rootCauses` (string[], required): 根本原因のリスト
- `fix` (string, required): 実施した修正内容
- `followUps` (string[], optional): フォローアップアクション

**戻り値**:
- `conclusion`: 記録された結論
  - `confidenceMarker`: 🟢 (高信頼)

**副作用**:
- ケースのステータスが `closed` に更新される

---

### bulk_delete_provisional

低信頼度の仮説とテスト計画を一括削除します。

**パラメータ**:
- `caseId` (string, required): 対象ケースの ID
- `confidenceThreshold` (number, optional): 信頼度の閾値 (デフォルト: 0.5)
- `priorityThreshold` (number, optional): 優先度の閾値 (デフォルト: 3)

**戻り値**:
- `deletedHypotheses`: 削除された仮説のリスト
- `deletedTestPlans`: 削除されたテスト計画のリスト
- `case`: 更新されたケース

**用途**:
- 調査が進んで不要になった仮説を整理
- 優先度の低いテスト計画をクリーンアップ
```

### 3. 実装計画

#### 3.1 ファイル構成

```
src/
├── prompts/
│   ├── index.ts                 # プロンプト登録
│   ├── rca-start.ts             # 調査開始
│   ├── rca-next-step.ts         # 次のステップ提案
│   ├── rca-hypotheses-guide.ts  # 仮説生成ガイド
│   ├── rca-verification.ts      # 検証計画支援
│   ├── rca-conclusion.ts        # 結論ガイド
│   ├── rca-best-practices.ts    # ベストプラクティス
│   ├── rca-help.ts              # ヘルプ
│   └── rca-tool-reference.ts    # ツールリファレンス
├── prompt-helpers/
│   ├── case-analyzer.ts         # ケース状態の分析
│   ├── template-renderer.ts     # テンプレートレンダリング
│   └── context-builder.ts       # コンテキスト構築
└── server.ts                     # プロンプト登録の追加
```

#### 3.2 実装ステップ

**Phase 1: 基本インフラ**
1. プロンプト登録機構の実装
2. テンプレートレンダラーの実装
3. ケース分析ヘルパーの実装

**Phase 2: コアプロンプト**
1. `rca/help` - ヘルプシステム
2. `rca/start-investigation` - 調査開始
3. `rca/next-step` - 次のステップ提案（最重要）

**Phase 3: 専門ガイド**
1. `rca/generate-hypotheses-guide`
2. `rca/verification-planning`
3. `rca/conclusion-guide`

**Phase 4: 補完機能**
1. `rca/best-practices`
2. `rca/tool-reference`

#### 3.3 コード例

##### プロンプト登録 (src/server.ts)

```typescript
import { registerPrompts } from './prompts/index.js';

export async function buildServer(streams?: TransportStreams) {
  // ... 既存のコード ...

  // プロンプト登録
  await registerPrompts(server);

  // ... 既存のコード ...
}
```

##### プロンプト定義 (src/prompts/rca-next-step.ts)

```typescript
import type { McpServer } from "../framework/mcpServerKit.js";
import { getCase } from "../data/caseStore.js";
import { analyzeCase } from "../prompt-helpers/case-analyzer.js";
import { renderTemplate } from "../prompt-helpers/template-renderer.js";

export async function registerNextStepPrompt(server: McpServer) {
  server.registerPrompt(
    "rca/next-step",
    {
      description: "Suggest the next action based on current case state",
      arguments: [
        {
          name: "caseId",
          description: "Target case ID",
          required: true,
        },
        {
          name: "currentPhase",
          description: "Current phase (observation/hypothesis/testing/conclusion)",
          required: false,
        },
      ],
    },
    async (args) => {
      const caseId = args.caseId as string;
      const result = await getCase(caseId);
      
      if (!result) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Error: Case ${caseId} not found`,
              },
            },
          ],
        };
      }

      const analysis = analyzeCase(result.case);
      const templateData = {
        caseId,
        currentPhase: args.currentPhase || analysis.phase,
        observationCount: result.case.observations.length,
        hypothesisCount: result.case.hypotheses.length,
        highConfidenceCount: result.case.hypotheses.filter(h => (h.confidence ?? 0) > 0.7).length,
        testPlanCount: result.case.tests.length,
        hasConclusion: result.case.conclusion ? "あり" : "なし",
        needMoreObservations: analysis.needMoreObservations,
        needHypotheses: analysis.needHypotheses,
        needTestPlans: analysis.needTestPlans,
        readyForConclusion: analysis.readyForConclusion,
        contextualHints: analysis.hints.join("\n- "),
        topHypothesisId: analysis.topHypothesis?.id,
        topHypothesisText: analysis.topHypothesis?.text,
      };

      const content = renderTemplate("rca-next-step", templateData);

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: content,
            },
          },
        ],
      };
    }
  );
}
```

##### ケース分析ヘルパー (src/prompt-helpers/case-analyzer.ts)

```typescript
import type { Case } from "../schema/case.js";

export interface CaseAnalysis {
  phase: "observation" | "hypothesis" | "testing" | "conclusion";
  needMoreObservations: boolean;
  needHypotheses: boolean;
  needTestPlans: boolean;
  readyForConclusion: boolean;
  topHypothesis?: {
    id: string;
    text: string;
    confidence: number;
  };
  hints: string[];
}

export function analyzeCase(caseData: Case): CaseAnalysis {
  const observations = caseData.observations.length;
  const hypotheses = caseData.hypotheses.length;
  const tests = caseData.tests.length;
  const hasConclusion = !!caseData.conclusion;

  // フェーズの判定
  let phase: CaseAnalysis["phase"] = "observation";
  if (hasConclusion) {
    phase = "conclusion";
  } else if (tests > 0) {
    phase = "testing";
  } else if (hypotheses > 0) {
    phase = "hypothesis";
  }

  // 次のアクション判定
  const needMoreObservations = observations < 3;
  const needHypotheses = observations >= 3 && hypotheses === 0;
  const needTestPlans = hypotheses > 0 && tests === 0;
  
  // 高信頼度の仮説が存在するか
  const highConfidenceHypotheses = caseData.hypotheses.filter(h => (h.confidence ?? 0) >= 0.8);
  const readyForConclusion = highConfidenceHypotheses.length > 0 && tests > 0;

  // トップ仮説
  const topHypothesis = caseData.hypotheses.length > 0
    ? caseData.hypotheses.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]
    : undefined;

  // コンテキストヒント
  const hints: string[] = [];
  
  if (needMoreObservations) {
    hints.push("まだ観測が少ないです。システムメトリクス、ログ、タイムラインを追加しましょう");
  }
  
  if (observations >= 5 && hypotheses === 0) {
    hints.push("十分な観測が集まりました。hypothesis_propose で LLM に仮説を生成させることをお勧めします");
  }
  
  if (hypotheses > 0 && tests === 0) {
    hints.push("仮説ができましたが、検証計画がありません。test_plan で検証方法を定義しましょう");
  }
  
  if (tests > 3) {
    hints.push("test_prioritize を使って、テスト計画の優先順位を付けると効率的です");
  }
  
  if (readyForConclusion) {
    hints.push("高信頼度の仮説と検証が完了しています。conclusion_finalize で結論をまとめましょう");
  }
  
  const lowConfidenceCount = caseData.hypotheses.filter(h => (h.confidence ?? 0) < 0.5).length;
  if (lowConfidenceCount > 3) {
    hints.push(`信頼度の低い仮説が ${lowConfidenceCount} 件あります。bulk_delete_provisional で整理できます`);
  }

  return {
    phase,
    needMoreObservations,
    needHypotheses,
    needTestPlans,
    readyForConclusion,
    topHypothesis: topHypothesis ? {
      id: topHypothesis.id,
      text: topHypothesis.text,
      confidence: topHypothesis.confidence ?? 0,
    } : undefined,
    hints,
  };
}
```

### 4. ユーザー体験フロー

#### シナリオ: 初心者ユーザーが RCA を実施

1. **調査開始**
   ```
   User: インシデントが発生しました。どこから始めればいいですか？
   LLM: rca/help を使ってガイダンスを表示します
   → ヘルプが表示され、rca/start-investigation が推奨される
   ```

2. **ケース作成**
   ```
   User: rca/start-investigation incidentSummary="API が 500 エラーを返す"
   → 詳細なガイダンスが表示される
   User: case_create に従ってケースを作成
   ```

3. **観測の記録**
   ```
   User: observation_add でいくつか観測を記録
   User: 次に何をすべきですか？
   LLM: rca/next-step caseId=case_xxx を実行
   → "さらに観測を追加" が推奨される
   ```

4. **仮説生成**
   ```
   User: 十分な観測を記録した
   LLM: rca/next-step を実行
   → "仮説の生成" が推奨され、hypothesis_propose の使い方が表示される
   User: hypothesis_propose を実行
   → LLM が複数の仮説を生成
   ```

5. **検証計画**
   ```
   LLM: rca/next-step を実行
   → "検証計画の作成" が推奨される
   User: rca/verification-planning で詳細ガイドを確認
   User: test_plan で各仮説の検証方法を定義
   ```

6. **結論**
   ```
   User: 検証が完了しました
   LLM: rca/next-step を実行
   → "結論のまとめ" が推奨される
   User: rca/conclusion-guide でガイドを確認
   User: conclusion_finalize で完了
   ```

### 5. テスト計画

#### 5.1 ユニットテスト
- テンプレートレンダリングのテスト
- ケース分析ロジックのテスト
- 各プロンプトの出力形式検証

#### 5.2 統合テスト
- プロンプトと実際のケースデータの統合
- エンドツーエンドの RCA フロー

#### 5.3 ユーザビリティテスト
- 初心者ユーザーによる実践テスト
- ガイダンスの分かりやすさ評価

### 6. 今後の拡張案

1. **対話型ウィザード**: ステップバイステップでユーザーを誘導
2. **テンプレートライブラリ**: よくあるインシデントタイプ別のテンプレート
3. **学習モード**: RCA の教育的な解説を強化
4. **進捗ダッシュボード**: 現在の RCA の進捗を可視化
5. **AIアシスタント統合**: Claude/GPT との深い統合で、自動提案を強化

### 7. 実装優先度

**高優先度** (MVP):
- rca/help
- rca/start-investigation
- rca/next-step
- ケース分析ヘルパー

**中優先度**:
- rca/generate-hypotheses-guide
- rca/verification-planning
- rca/conclusion-guide

**低優先度** (Nice to have):
- rca/best-practices
- rca/tool-reference (動的生成)

---

## まとめ

この設計により、MCP-RCA は単なるデータ管理ツールから、ユーザーを積極的にガイドする対話的な RCA 支援システムへと進化します。プロンプトベースのアプローチにより、LLM がコンテキストに応じた適切なアドバイスを提供し、初心者でも体系的な RCA を実施できるようになります。
