import axios from 'axios';
import type {
  AppSettings,
  AuthUser,
  AutoGenerateResult,
  DashboardSummary,
  EBReading,
  House,
  HouseReportRow,
  MonthlyReportRow,
  RentHistoryEntry,
  RentRecord,
} from './types';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const loginWithGoogle = (code: string) =>
  api.post<{ token: string; user: AuthUser }>('/auth/google', { code }).then((r) => r.data);
export const logout = () => api.post('/auth/logout');
export const getMe = () => api.get<{ user: AuthUser }>('/auth/me').then((r) => r.data);

// Houses
export const getHouses = () => api.get<House[]>('/houses').then((r) => r.data);
export const getHouse = (id: number) => api.get<House>(`/houses/${id}`).then((r) => r.data);
export const updateHouse = (id: number, data: Partial<House>) =>
  api.put<House>(`/houses/${id}`, data).then((r) => r.data);
export const uploadHouseProof = (id: number, file: File) => {
  const formData = new FormData();
  formData.append('proof', file);
  return api
    .post<{ proof_file_path: string }>(`/houses/${id}/proof`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

// Records
export const getRecords = (params: { house_id?: number; month_from?: string; month_to?: string }) =>
  api.get<RentRecord[]>('/records', { params }).then((r) => r.data);
export const getRecord = (house: number, month: string) =>
  api.get<RentRecord>(`/records/${house}/${month}`).then((r) => r.data);
export const saveRecord = (data: Partial<RentRecord>) => api.post<RentRecord>('/records', data).then((r) => r.data);
export const saveRecordsBulk = (data: Partial<RentRecord>[]) =>
  api.post<RentRecord[]>('/records/bulk', data).then((r) => r.data);
export const autoGenerateRecords = (month: string, house_ids?: number[]) =>
  api.post<AutoGenerateResult>('/records/auto-generate', { month, house_ids }).then((r) => r.data);

// EB readings
export const getEBReadings = (params: { house_id?: number; year?: string }) =>
  api.get<EBReading[]>('/eb', { params }).then((r) => r.data);
export const saveEBReading = (data: Partial<EBReading>) => api.post<EBReading>('/eb', data).then((r) => r.data);

// Rent history
export const getRentHistory = (house_id?: number) =>
  api.get<RentHistoryEntry[]>('/rent-history', { params: { house_id } }).then((r) => r.data);
export const addRentHistory = (data: Partial<RentHistoryEntry>) =>
  api.post<RentHistoryEntry>('/rent-history', data).then((r) => r.data);

// Reports
export const getMonthlyReport = (year: string) =>
  api.get<MonthlyReportRow[]>('/reports/monthly', { params: { year } }).then((r) => r.data);
export const getHouseReport = (year: string) =>
  api.get<HouseReportRow[]>('/reports/houses', { params: { year } }).then((r) => r.data);
export const getDashboardSummary = (month?: string) =>
  api.get<DashboardSummary>('/reports/dashboard', { params: { month } }).then((r) => r.data);

// Backup
export const triggerBackupEmail = () => api.post<{ sent: boolean }>('/backup/run').then((r) => r.data);

// Settings
export const getSettings = () => api.get<AppSettings>('/settings').then((r) => r.data);
export const updateSettings = (data: Partial<AppSettings>) => api.put<AppSettings>('/settings', data).then((r) => r.data);
