function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let text = String(value);

  // Prevent spreadsheet formula injection.
  if (
  typeof value === "string" &&
  /^[\s]*[=+\-@\t\r]/.test(text)
) {
  text = `'${text}`;
}

  // Escape double quotes.
  text = text.replace(/"/g, '""');

  // Quote values containing CSV special characters.
  if (/[",\r\n]/.test(text)) {
    text = `"${text}"`;
  }

  return text;
}

export function generateCsv(
  headers: string[],
  rows: unknown[][],
): string {
  const headerRow = headers.map(escapeCsvValue).join(",");

  const dataRows = rows.map((row) =>
    row.map(escapeCsvValue).join(","),
  );

  // BOM helps Excel recognize UTF-8 correctly.
  return "\uFEFF" + [headerRow, ...dataRows].join("\r\n");
}