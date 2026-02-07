/** 標準郵便番号データ（ken_all.csv 由来） */
export type KenAllAddress = {
  source: "ken_all";
  postalCode: string;
  oldPostalCode: string;
  jisCode: string;
  prefecture: string;
  prefectureKana: string;
  city: string;
  cityKana: string;
  town: string;
  townKana: string;
  multiPostalCode: boolean;
  koazabanchi: boolean;
  chome: boolean;
  multiTown: boolean;
};

/** 事業所個別郵便番号データ（JIGYOSYO.CSV 由来） */
export type JigyosyoAddress = {
  source: "jigyosyo";
  postalCode: string;
  oldPostalCode: string;
  jisCode: string;
  prefecture: string;
  city: string;
  town: string;
  streetAddress: string;
  companyName: string;
  companyNameKana: string;
  postOffice: string;
  codeType: 0 | 1;
};

export type Address = KenAllAddress | JigyosyoAddress;
