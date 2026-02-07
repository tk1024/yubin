import { describe, expect, it } from "vitest";
import { getAddress } from "../get-address";

describe("getAddress", () => {
  describe("標準郵便番号（ken_all）", () => {
    it("東京都渋谷区神宮前（150-0001）を取得できる", () => {
      const result = getAddress("1500001");
      expect(result).not.toBeNull();
      expect(result?.source).toBe("ken_all");
      expect(result?.postalCode).toBe("1500001");
      expect(result?.prefecture).toBe("東京都");
      expect(result?.city).toBe("渋谷区");
      expect(result?.town).toBe("神宮前");
      if (result?.source === "ken_all") {
        expect(result.prefectureKana).toBe("トウキョウト");
        expect(result.cityKana).toBe("シブヤク");
        expect(result.townKana).toBe("ジングウマエ");
      }
    });

    it("ハイフン付きで取得できる", () => {
      const result = getAddress("150-0001");
      expect(result).not.toBeNull();
      expect(result?.prefecture).toBe("東京都");
    });

    it("全角数字で取得できる", () => {
      const result = getAddress("１５０ー０００１");
      expect(result).not.toBeNull();
      expect(result?.prefecture).toBe("東京都");
    });
  });

  describe("事業所郵便番号（jigyosyo）", () => {
    it("事業所郵便番号を取得できる", () => {
      const result = getAddress("060-8621");
      expect(result).not.toBeNull();
      expect(result?.source).toBe("jigyosyo");
      expect(result?.prefecture).toBe("北海道");
      expect(result?.city).toBe("札幌市中央区");
      if (result?.source === "jigyosyo") {
        expect(result.companyName).toBeTruthy();
      }
    });
  });

  describe("エッジケース", () => {
    it("存在しない郵便番号は null を返す", () => {
      expect(getAddress("0000000")).toBeNull();
    });

    it("空文字列は null を返す", () => {
      expect(getAddress("")).toBeNull();
    });

    it("不正な文字列は null を返す", () => {
      expect(getAddress("abcdefg")).toBeNull();
    });

    it("桁数が足りない場合は null を返す", () => {
      expect(getAddress("150")).toBeNull();
    });
  });
});
