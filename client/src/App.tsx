import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthCallback } from './pages/AuthCallback';
import { Dashboard } from './pages/Dashboard';
import { EBTracker } from './pages/EBTracker';
import { Ledger } from './pages/Ledger';
import { Login } from './pages/Login';
import { RentEntry } from './pages/RentEntry';
import { Receipt } from './pages/Receipt';
import { RentHistory } from './pages/RentHistory';
import { Report } from './pages/Report';
import { Tenants } from './pages/Tenants';
import { WhatsApp } from './pages/WhatsApp';
import { Setup } from './pages/Setup';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="/monthly" element={<RentEntry />} />
        <Route path="/bulk" element={<Navigate to="/monthly" replace />} />
        <Route path="/ledger" element={<Ledger />} />
        <Route path="/receipt" element={<Receipt />} />
        <Route path="/eb" element={<EBTracker />} />
        <Route path="/tenants" element={<Tenants />} />
        <Route path="/rent-history" element={<RentHistory />} />
        <Route path="/report" element={<Report />} />
        <Route path="/whatsapp" element={<WhatsApp />} />
        <Route path="/settings" element={<Setup />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
