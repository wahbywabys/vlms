/**
 * Reads an admin import file (.xlsx from the templates in public/templates,
 * or .csv) into row objects keyed for the API. Headers are matched on either
 * line of the template's "English\nالعربية" header, ignoring case, spaces
 * and the required-mark "*", so a sheet with reordered, English-only or
 * Arabic-only headers still imports. Empty rows are dropped.
 */
import { readSheet } from 'read-excel-file/browser';

type Columns = Record<string, string[]>;

export const MACHINE_COLUMNS: Columns = {
  centerCode: ['Center code', 'Centre code', 'رمز المركز'], centerName: ['Center name', 'Centre name', 'اسم المركز'],
  centerNameAr: ['Center name (Arabic)', 'Centre name (Arabic)', 'اسم المركز بالعربية'], region: ['Governorate', 'Region', 'المحافظة'],
  workshop: ['Workshop', 'الورشة'], workshopAr: ['Workshop (Arabic)', 'الورشة بالعربية'], machineType: ['Machine type', 'Type', 'نوع الماكينة'],
  name: ['Machine name', 'اسم الماكينة'], brand: ['Brand', 'Make', 'الماركة'], model: ['Model', 'الموديل'],
  serial: ['Serial number', 'Serial', 'Serial no', 'الرقم التسلسلي'], assetTag: ['Asset tag (leave blank)', 'Asset tag', 'رقم الأصل (اتركه فارغًا)', 'رقم الأصل'],
  year: ['Year made', 'Year', 'سنة الصنع'], status: ['Status', 'الحالة'], competencyCode: ['Required skill code', 'رمز المهارة المطلوبة'],
  photo: ['Photo file name', 'Photo', 'اسم ملف الصورة', 'الصورة'], notes: ['Notes', 'ملاحظات'],
};

export const PROGRAM_COLUMNS: Columns = {
  programCode: ['Programme code', 'Program code', 'رمز التخصص'], programName: ['Programme name', 'Program name', 'اسم التخصص'],
  programNameAr: ['Programme name (Arabic)', 'Program name (Arabic)', 'اسم التخصص بالعربية'], competencyCode: ['Skill code', 'Competency code', 'رمز المهارة'],
  level: ['Level', 'Kind', 'المستوى'], parentCode: ['Parent code', 'رمز المستوى الأعلى'], title: ['Skill title', 'Title', 'عنوان المهارة'],
  titleAr: ['Skill title (Arabic)', 'Title (Arabic)', 'عنوان المهارة بالعربية'], safetyCritical: ['Safety-critical', 'Safety critical', 'سلامة حرجة'],
  hours: ['Hours', 'Nominal hours', 'الساعات'],
};

const norm = (s: string) => s.replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Minimal RFC 4180 CSV parser (quoted fields, doubled quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const src = text.replace(/^﻿/, '');
  const sep = (src.split(/\r?\n/, 1)[0]!.match(/;/g)?.length ?? 0) > (src.split(/\r?\n/, 1)[0]!.match(/,/g)?.length ?? 0) ? ';' : ',';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export interface SheetRows { rows: Record<string, unknown>[]; unknownHeaders: string[]; missing: string[] }

/** `sheet`: the template's data sheet name; falls back to the first sheet that has a matching header row. */
export async function readImportFile(file: File, columns: Columns, sheet: string, required: string[]): Promise<SheetRows> {
  let grid: unknown[][];
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') grid = parseCsv(await file.text());
  else {
    grid = await readSheet(file, sheet).catch(async () => {
      const first = await readSheet(file);
      return first;
    }) as unknown[][];
  }
  const lookup = new Map<string, string>();
  for (const [key, names] of Object.entries(columns)) for (const n of names) lookup.set(norm(n), key);
  const head = (grid[0] ?? []).map((h) => {
    const lines = String(h ?? '').split(/\r?\n/);
    for (const l of lines) { const k = lookup.get(norm(l)); if (k) return k; }
    return null;
  });
  const unknownHeaders = (grid[0] ?? []).filter((_, i) => !head[i] && String(grid[0]![i] ?? '').trim()).map(String);
  const rows = grid.slice(1).map((r) => {
    const o: Record<string, unknown> = {};
    head.forEach((k, i) => {
      if (!k) return;
      const v = r[i];
      if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return;
      o[k] = v instanceof Date ? v.getFullYear() : typeof v === 'string' ? v.trim() : v;
    });
    return o;
  }).filter((o) => Object.keys(o).length > 0);
  const missing = required.filter((k) => !head.includes(k));
  return { rows, unknownHeaders, missing };
}
