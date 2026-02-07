import { describe, expect, it } from "vitest";
import { normalizePostalCode } from "../normalize";

describe("normalizePostalCode", () => {
  it("7桁の数字をそのまま返す", () => {
    expect(normalizePostalCode("1500001")).toBe("1500001");
  });

  it("ハイフン付きの郵便番号からハイフンを除去する", () => {
    expect(normalizePostalCode("150-0001")).toBe("1500001");
  });

  it("全角ハイフン（－）を除去する", () => {
    expect(normalizePostalCode("150－0001")).toBe("1500001");
  });

  it("長音（ー）を除去する", () => {
    expect(normalizePostalCode("150ー0001")).toBe("1500001");
  });

  it("全角数字を半角に変換する", () => {
    expect(normalizePostalCode("１５０００００")).toBe("1500000");
  });

  it("全角数字+ハイフンの組み合わせ", () => {
    expect(normalizePostalCode("１５０ー０００１")).toBe("1500001");
  });

  it("〒を除去する", () => {
    expect(normalizePostalCode("〒150-0001")).toBe("1500001");
  });

  it("前後の空白を除去する", () => {
    expect(normalizePostalCode("  1500001  ")).toBe("1500001");
  });

  it("〒+空白+ハイフンの組み合わせ", () => {
    expect(normalizePostalCode(" 〒 １５０−０００１ ")).toBe("1500001");
  });

  it("空文字列は null を返す", () => {
    expect(normalizePostalCode("")).toBeNull();
  });

  it("桁数が足りない場合は null を返す", () => {
    expect(normalizePostalCode("15000")).toBeNull();
  });

  it("桁数が多い場合は null を返す", () => {
    expect(normalizePostalCode("15000010")).toBeNull();
  });

  it("数字以外の文字が含まれる場合は null を返す", () => {
    expect(normalizePostalCode("150abc1")).toBeNull();
  });
});
