import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthCallback } from './pages/AuthCallback';
import { Bulk } from './pages/Bulk';
import { Dashboard } from './pages/Dashboard';
import { EBTracker } from './pages/EBTracker';
import { Ledger } from './pages/Ledger';
import { Login } from './pages/Login';
import { Monthly } from './pages/Monthly';
import { Receipt } from './pages/Receipt';
import { Placeholder } from './pages/Placeholder';
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
        <Route path="/monthly" element={<Monthly />} />
        <Route path="/bulk" element={<Bulk />} />
        <Route path="/ledger" element={<Ledger />} />
        <Route path="/receipt" element={<Receipt />} />
        <Route path="/eb" element={<EBTracker />} />
        <Route path="/tenants" element={<Placeholder title="குடியிருப்பாளர்" />} />
        <Route path="/rent-history" element={<Placeholder title="வாடகை வரலாறு" />} />
        <Route path="/report" element={<Placeholder title="அறிக்கை" />} />
        <Route path="/whatsapp" element={<Placeholder title="WhatsApp நினைவூட்டல்" />} />
        <Route path="/settings" element={<Setup />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
