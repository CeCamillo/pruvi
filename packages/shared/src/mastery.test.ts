import { describe, expect, it } from "vitest";
import { computeMastery, masteryStateRank, MASTERY_THRESHOLDS } from "./mastery";

describe("computeMastery", () => {
  it("returns aprendendo when efAvg is null", () => {
    expect(computeMastery(null, 0)).toBe("aprendendo");
    expect(computeMastery(null, 50)).toBe("aprendendo");
  });

  it("returns aprendendo when reviewCount < 5 regardless of efAvg", () => {
    expect(computeMastery(3.0, 4)).toBe("aprendendo");
    expect(computeMastery(2.5, 0)).toBe("aprendendo");
  });

  it("returns aprendendo when efAvg < 2.0", () => {
    expect(computeMastery(1.99, 100)).toBe("aprendendo");
    expect(computeMastery(1.3, 50)).toBe("aprendendo");
  });

  it("returns entendendo for EF in [2.0, 2.4) with >=5 reviews", () => {
    expect(computeMastery(2.0, 5)).toBe("entendendo");
    expect(computeMastery(2.39, 10)).toBe("entendendo");
  });

  it("returns aprendendo when EF would qualify for entendendo but reviews < 5", () => {
    expect(computeMastery(2.3, 4)).toBe("aprendendo");
  });

  it("returns afiado for EF in [2.4, 2.8) with >=8 reviews", () => {
    expect(computeMastery(2.4, 8)).toBe("afiado");
    expect(computeMastery(2.79, 20)).toBe("afiado");
  });

  it("downgrades to entendendo when EF qualifies for afiado but reviews < 8", () => {
    expect(computeMastery(2.5, 7)).toBe("entendendo");
  });

  it("returns quase_mestre for EF >= 2.8 with >=12 reviews", () => {
    expect(computeMastery(2.8, 12)).toBe("quase_mestre");
    expect(computeMastery(3.0, 50)).toBe("quase_mestre");
  });

  it("downgrades to afiado when EF qualifies for quase_mestre but reviews < 12", () => {
    expect(computeMastery(2.9, 11)).toBe("afiado");
  });
});

describe("masteryStateRank", () => {
  it("orders states from aprendendo (0) to quase_mestre (3)", () => {
    expect(masteryStateRank("aprendendo")).toBe(0);
    expect(masteryStateRank("entendendo")).toBe(1);
    expect(masteryStateRank("afiado")).toBe(2);
    expect(masteryStateRank("quase_mestre")).toBe(3);
  });
});

describe("MASTERY_THRESHOLDS", () => {
  it("exposes the thresholds as a frozen-shape constant", () => {
    expect(MASTERY_THRESHOLDS.entendendo.minReviews).toBe(5);
    expect(MASTERY_THRESHOLDS.afiado.minReviews).toBe(8);
    expect(MASTERY_THRESHOLDS.quase_mestre.minReviews).toBe(12);
  });
});
