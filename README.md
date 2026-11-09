# yubin

Japanese postal code to address lookup. Offline, sync API. Node.js / browser.

- 標準郵便番号（ken_all）と事業所個別郵便番号（JIGYOSYO）の両方に対応
- 同期 API — `await` 不要
- Node.js / ブラウザ両対応
- データは npm パッケージに同梱（オフライン動作）

## Install

```bash
npm install yubin
```

## Usage

```ts
import { getAddress } from "yubin";

// 標準郵便番号
const address = getAddress("150-0001");
// => {
//   source: "ken_all",
//   postalCode: "1500001",
//   prefecture: "東京都",
//   city: "渋谷区",
//   town: "神宮前",
//   ...
// }

// 事業所郵便番号
const biz = getAddress("060-8621");
// => {
//   source: "jigyosyo",
//   postalCode: "0608621",
//   prefecture: "北海道",
//   city: "札幌市中央区",
//   town: "北一条西",
//   companyName: "日本経済新聞社　北海道支社",
//   ...
// }

// 見つからない場合
const notFound = getAddress("0000000");
// => null
```

ハイフンあり/なし、全角数字、`〒` 付きなど、さまざまな入力形式に対応しています。

```ts
getAddress("1500001");      // OK
getAddress("150-0001");     // OK
getAddress("１５０ー０００１"); // OK
getAddress("〒150-0001");   // OK
```

## API

### `getAddress(postalCode: string): Address | null`

郵便番号から住所情報を取得します。

- 見つかった場合: `KenAllAddress | JigyosyoAddress`
- 見つからない場合: `null`
- 同一郵便番号が両データに存在する場合は事業所データを優先

### `normalizePostalCode(input: string): string | null`

郵便番号を正規化します（ハイフン除去・全角→半角変換・`〒` 除去）。
正規化後に7桁の数字でない場合は `null` を返します。

## Types

```ts
type KenAllAddress = {
  source: "ken_all";
  postalCode: string;        // 郵便番号（7桁）
  oldPostalCode: string;     // 旧郵便番号（5桁）
  jisCode: string;           // 全国地方公共団体コード
  prefecture: string;        // 都道府県名
  prefectureKana: string;    // 都道府県名カナ
  city: string;              // 市区町村名
  cityKana: string;          // 市区町村名カナ
  town: string;              // 町域名
  townKana: string;          // 町域名カナ
  multiPostalCode: boolean;  // 一町域が二以上の郵便番号で表される
  koazabanchi: boolean;      // 小字毎に番地が起番されている町域
  chome: boolean;            // 丁目を有する町域
  multiTown: boolean;        // 一つの郵便番号で二以上の町域を表す
};

type JigyosyoAddress = {
  source: "jigyosyo";
  postalCode: string;        // 郵便番号（7桁）
  oldPostalCode: string;     // 旧郵便番号（5桁）
  jisCode: string;           // 全国地方公共団体コード
  prefecture: string;        // 都道府県名
  city: string;              // 市区町村名
  town: string;              // 町域名
  streetAddress: string;     // 小字名・丁目・番地
  companyName: string;       // 事業所名
  companyNameKana: string;   // 事業所名カナ
  postOffice: string;        // 取扱局
  codeType: 0 | 1;           // 0=大口事業所, 1=私書箱
};

type Address = KenAllAddress | JigyosyoAddress;
```

## Data Source

[日本郵便](https://www.post.japanpost.jp/zipcode/)が無償公開している以下のデータを使用しています。

| ファイル | 内容 |
|---|---|
| utf_ken_all.csv | 標準郵便番号（約12万件） |
| JIGYOSYO.CSV | 事業所個別郵便番号（約2万件） |

データはビルド時に deflate 圧縮してパッケージに同梱されます。
データの更新はパッケージのバージョンアップで反映されます。

### データの取得と検証

```bash
pnpm install --frozen-lockfile
pnpm download:data
pnpm build:data
pnpm typecheck && pnpm test && pnpm build
```

`download:data` は両CSVのHTTP応答、ZIP、文字コード、列数、最低件数を検証します。
`build:data` は、元CSVのSHA-256と収録件数を `postal-data.json` に記録します。
このファイルはnpmパッケージにも同梱されるため、収録データを確認できます。

日次更新は `.github/workflows/release.yml` に集約しています。毎日9:23 JSTに以下を実行します。

1. 日本郵便から両CSVを取得し、データを検証します。
2. npmの最新公開版に同梱された `postal-data.json` と比較します。旧版にこのファイルがない場合は、初回更新として扱います。
3. データに変更があればパッチ版を選び、lint・型チェック・テスト・ビルドを実行します。
4. 検証後にバージョンと取得記録をmainへコミットし、npmに公開してGitHub Releaseを作成します。

同じデータでは再公開しません。npm公開が失敗しても、次回は実際の公開版と比較するため再試行できます。
npmの公開要求が成功した後も、公開前のスキャンで取得可能になるまで時間がかかります。
このワークフローは、公開要求が成功した実行に限り30秒間隔で最大30分待機します。
期限内に取得できなければ、サマリーに「受付済み・取得未確認」と記録して停止します。
その際は、対象バージョンがnpmで取得可能になったことを確認してからワークフローを再実行してください。
GitHub Releaseの作成だけが失敗したときは、次版を公開する前に作成を再試行します。
タグの対象にはnpmが記録した公開元コミットを使用するため、その後mainが進んでも公開元を保持できます。
取得やnpmの照会に失敗した場合は、その実行を失敗にして公開を止めます。
取得から公開まで同じCSVを使用します。

GitHubの非活動による定期実行停止を防ぐため、変更のない月も取得記録をmainへ月1回コミットします。
このため、Actionsの `contents: write` とmainへの書き込み許可が必要です。
ブランチ保護で書き込みを制限する場合は、運用に合わせて更新方法を変更してください。

npmのTrusted Publisherは、既存の `release.yml` を使用します。
Actionsの `Release and update postal data` から手動実行することもできます。
`v*` タグによる手動リリースも引き続き使えます。タグ名と `package.json` のバージョンを一致させてください。
mainの `package.json` を公開済みの版より大きいバージョンに更新したときも、次回の定期実行で公開します。
データ変更だけを公開する運用では、npmの `latest` を最新の正式版に保ってください。
実行の成否に加えて、サマリーの公開バージョンと取得データのハッシュを確認できます。

## License

MIT
