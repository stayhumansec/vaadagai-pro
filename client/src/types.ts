export type PayStatus = 'full' | 'partial' | 'none';
export type HouseStatus = 'Active' | 'Inactive';

export interface House {
  id: number;
  name: string;
  phone: string | null;
  default_rent: number;
  water: number;
  maintenance: number;
  members: number;
  eb_rate: number;
  proof_type: string;
  proof_number: string | null;
  move_in_date: string | null;
  move_out_date: string | null;
  status: HouseStatus;
  proof_file_path: string | null;
  advance: number;
}

export interface RentRecord {
  id: number;
  house_id: number;
  month: string;
  rent: number;
  water: number;
  eb: number;
  maintenance: number;
  mun_bakki: number;
  total: number;
  pay_status: PayStatus;
  received: number;
  balance: number;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface EBReading {
  id: number;
  house_id: number;
  month: string;
  start_reading: number;
  end_reading: number;
  units: number;
  rate: number;
  amount: number;
  created_at: string;
}

export interface TenantHistoryEntry {
  id: number;
  house_id: number;
  name: string;
  phone: string | null;
  members: number;
  proof_type: string | null;
  proof_number: string | null;
  move_in_date: string | null;
  move_out_date: string | null;
  created_at: string;
  advance: number;
}

export interface RentHistoryEntry {
  id: number;
  house_id: number;
  effective_from: string;
  rent: number;
  water: number;
  maintenance: number;
  eb_rate: number;
  note: string;
  created_at: string;
}

export interface DashboardSummary {
  month: string;
  billed: number;
  collected: number;
  balance: number;
  mun_bakki: number;
  dueCount: number;
  activeCount: number;
  inactiveCount: number;
}

export interface MonthlyReportRow {
  month: string;
  billed: number;
  collected: number;
  balance: number;
}

export interface HouseReportRow {
  house_id: number;
  name: string;
  months: number;
  billed: number;
  collected: number;
  balance: number;
}

export interface AutoGenerateResult {
  created: number[];
  skipped: number[];
  missingEB: number[];
}

export interface AuthUser {
  googleId: string;
  email: string;
  name: string;
}

export interface AppSettings {
  owner_name: string;
  default_eb_rate: number;
  default_language: string;
  owner_email: string;
}
