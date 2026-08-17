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

export async function readExcelSheet(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col] = String(cell.value ?? '').trim();
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const header = headers[col];
      if (!header) return;
      const value = cell.value;
      record[header] = value === null || value === undefined ? '' : String(value).trim();
      if (record[header]) hasValue = true;
    });
    if (hasValue) rows.push(record);
  });

  return rows;
}
