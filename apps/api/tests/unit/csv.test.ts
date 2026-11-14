import { describe, expect, it } from "vitest";
import { generateCsv } from "../../src/utils/csv";

describe("generateCsv", () => {
  it("generates CSV headers and rows", () => {
    const result = generateCsv(
      ["Name", "Email"],
      [["John Doe", "john@example.com"]],
    );

    expect(result).toBe("\uFEFFName,Email\r\nJohn Doe,john@example.com");
  });

  it("escapes commas inside values", () => {
    const result = generateCsv(["Name"], [["John, Doe"]]);

    expect(result).toBe('\uFEFFName\r\n"John, Doe"');
  });

  it("escapes double quotes inside values", () => {
    const result = generateCsv(["Description"], [['He said "Hello"']]);

    expect(result).toBe('\uFEFFDescription\r\n"He said ""Hello"""');
  });

  it("escapes line breaks inside values", () => {
    const result = generateCsv(["Description"], [["First line\nSecond line"]]);

    expect(result).toBe('\uFEFFDescription\r\n"First line\nSecond line"');
  });

  it("handles null and undefined values as empty cells", () => {
    const result = generateCsv(["Phone", "Email"], [[null, undefined]]);

    expect(result).toBe("\uFEFFPhone,Email\r\n,");
  });

  it.each([
    "=SUM(A1:A2)",
    "+SUM(A1:A2)",
    "-1+2",
    "@SUM(A1:A2)",
    "\t=SUM(A1:A2)",
    "\r=SUM(A1:A2)",
    "  =SUM(A1:A2)",
  ])("protects formula-like values: %s", (value) => {
    const result = generateCsv(["Value"], [[value]]);

    expect(result).toContain(`'${value}`);
  });

  it("preserves numeric values without treating negative numbers as formulas", () => {
    const result = generateCsv(["Price", "Quantity"], [[-150, 5]]);

    expect(result).toBe("\uFEFFPrice,Quantity\r\n-150,5");
  });

  it("returns headers when there are no data rows", () => {
    const result = generateCsv(["Name", "Email"], []);

    expect(result).toBe("\uFEFFName,Email");
  });

  it("handles multiple rows", () => {
    const result = generateCsv(
      ["Name", "Role"],
      [
        ["Alice", "buyer"],
        ["Bob", "agent"],
      ],
    );

    expect(result).toBe("\uFEFFName,Role\r\nAlice,buyer\r\nBob,agent");
  });
});
