// รายการตาราง (ปุ่มในเมนู) — ขั้นถัดไปเพิ่ม SMC / Key / OT ที่นี่
export interface TableDef {
  id: string;
  label: string;
  title: string;
  section: 1 | 2 | 3;
}

export const TABLES: TableDef[] = [
  { id: "s1", label: "6.00-8.30", title: "ตาราง 6.00-8.30", section: 1 },
  { id: "s2", label: "8.30-12.30", title: "ตาราง 8.30-12.30", section: 2 },
  { id: "s3", label: "12.30-16.30", title: "ตาราง 12.30-16.30", section: 3 },
];

export const tableById = (id: string) => TABLES.find((t) => t.id === id);
