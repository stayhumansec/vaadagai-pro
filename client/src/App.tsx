import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthCallback } from './pages/AuthCallback';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
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
        <Route path="/monthly" element={<Placeholder title="மாத பதிவு" />} />
        <Route path="/bulk" element={<Placeholder title="மொத்த பதிவு" />} />
        <Route path="/ledger" element={<Placeholder title="பதிவேடு" />} />
        <Route path="/receipt" element={<Placeholder title="ரசீது" />} />
        <Route path="/eb" element={<Placeholder title="EB டிராக்கர்" />} />
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
