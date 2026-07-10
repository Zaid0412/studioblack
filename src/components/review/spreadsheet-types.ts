/** Fortune Sheet cell/sheet shapes shared by SpreadsheetViewer and its parse worker. */

export interface FortuneSheetCell {
  r: number;
  c: number;
  v: {
    v: string | number | boolean | null;
    m?: string;
    ct?: { fa: string; t: string };
    bl?: number;
    it?: number;
    fc?: string;
    bg?: string;
    fs?: number;
    ht?: number;
    vt?: number;
    mc?: { r: number; c: number; rs: number; cs: number };
  };
}

export interface FortuneSheetData {
  name: string;
  celldata: FortuneSheetCell[];
  order: number;
  row?: number;
  column?: number;
  config?: Record<string, unknown>;
  frozen?: {
    type: string;
    range?: { row_focus: number; column_focus: number };
  };
}

/** Message the parse worker posts back to the component. */
export type SpreadsheetWorkerResult =
  | { ok: true; sheets: FortuneSheetData[] }
  | { ok: false; error: string };
