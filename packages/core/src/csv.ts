export interface CsvRow {
  line: number;
  values: Record<string, string>;
}

export function parseCsv(text: string): CsvRow[] {
  const rows = splitCsvRecords(text);
  if (rows.length === 0) return [];
  const headers = rows[0]?.map((header) => header.trim().toLowerCase()) ?? [];
  const parsed: CsvRow[] = [];
  rows.slice(1).forEach((cells, index) => {
    if (cells.every((cell) => cell.trim() === "")) return;
    const values: Record<string, string> = {};
    headers.forEach((header, cellIndex) => {
      if (!header) return;
      values[header] = cells[cellIndex]?.trim() ?? "";
    });
    parsed.push({ line: index + 2, values });
  });
  return parsed;
}

function splitCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    records.push(row);
  }
  return records;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(row.map((value) => escapeCell(value == null ? "" : String(value))).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
