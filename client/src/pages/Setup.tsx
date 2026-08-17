import { useAuth } from '../context/AuthContext';

export function Setup() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <h2 className="font-medium text-navy">Google OAuth</h2>
        <p className="mt-1 text-sm text-gray">
          Client ID மற்றும் redirect URI சர்வர் / கிளையண்ட் .env கோப்புகளில் அமைக்கப்படுகின்றன.
        </p>
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <h2 className="font-medium text-navy">உரிமையாளர்</h2>
        <p className="mt-1 text-sm text-gray">{user?.name ?? '—'}</p>
        <p className="text-sm text-gray">{user?.email ?? '—'}</p>
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4 text-sm text-gray">
        வாடகை Pro v1.0.0
      </div>
    </div>
  );
}
