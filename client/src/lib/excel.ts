import ExcelJS from 'exceljs';

export interface ExcelSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

export async function downloadExcel(sheets: ExcelSheet[], filename: string) {
  const workbook = new ExcelJS.Workbook();

  for (const { name, headers, rows } of sheets) {
    const sheet = workbook.addWorksheet(name.slice(0, 31));
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));
    sheet.columns.forEach((col) => { col.width = 16; });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Excel silently reinterprets a typed value like "2023-01" or "2026-08-19" as
// a real date cell rather than text, and ExcelJS then hands that cell back as
// a JS Date. Format it as a plain YYYY-MM-DD string (using UTC getters, since
// Excel dates carry no timezone and ExcelJS parses them at UTC midnight) so
// every downstream "YYYY-MM"/"YYYY-MM-DD" parser sees the text it expects
// instead of a Date's default toString().
function cellValueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // A formula cell's value isn't a scalar — ExcelJS hands back
  // { formula, result } (or { sharedFormula, result } for cells sharing
  // another cell's formula). Use the last-calculated result instead of
  // stringifying the object. A formula Excel never recalculated has no
  // cached result at all — treat that as blank rather than leaking
  // "[object Object]" into the imported data.
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if ('result' in obj) return cellValueToString(obj.result);
    if ('formula' in obj || 'sharedFormula' in obj) return '';
  }
  return String(value).trim();
}

export async function readExcelSheet(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col] = cellValueToString(cell.value);
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const header = headers[col];
      if (!header) return;
      record[header] = cellValueToString(cell.value);
      if (record[header]) hasValue = true;
    });
    if (hasValue) rows.push(record);
  });

  return rows;
}
