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

## License

MIT
