import { describe, expect, it } from "bun:test";
import { formatXpCompact, formatXpFull } from "../format-xp";

describe("formatXpCompact", () => {
  it("formats values under 1000 plainly", () => {
    expect(formatXpCompact(0)).toBe("0");
    expect(formatXpCompact(50)).toBe("50");
    expect(formatXpCompact(999)).toBe("999");
  });

  it("formats thousands with one decimal and 'k' suffix", () => {
    expect(formatXpCompact(1000)).toBe("1k");
    expect(formatXpCompact(2400)).toBe("2.4k");
    expect(formatXpCompact(12450)).toBe("12.4k");
    expect(formatXpCompact(123456)).toBe("123.5k");
  });
});

describe("formatXpFull", () => {
  it("uses pt-BR thousands separator (.)", () => {
    expect(formatXpFull(0)).toBe("0");
    expect(formatXpFull(50)).toBe("50");
    expect(formatXpFull(1000)).toBe("1.000");
    expect(formatXpFull(12450)).toBe("12.450");
    expect(formatXpFull(1000000)).toBe("1.000.000");
  });
});
