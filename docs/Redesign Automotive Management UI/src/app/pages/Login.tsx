import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Car, LogIn } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState('');

  const users = [
    { id: '1', name: 'Admin User', role: 'Manager', avatar: 'AU' },
    { id: '2', name: 'Service Tech', role: 'Technician', avatar: 'ST' },
    { id: '3', name: 'Front Desk', role: 'Receptionist', avatar: 'FD' },
  ];

  const handleLogin = () => {
    if (selectedUser) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl items-center justify-center mb-4">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Automotive Management</h1>
          <p className="text-gray-400">Select your user to continue</p>
        </div>

        {/* Login Card */}
        <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-8">
          <h2 className="text-xl font-semibold mb-6">Sign In</h2>

          <div className="space-y-3 mb-6">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                  selectedUser === user.id
                    ? 'border-blue-500 bg-blue-900/30'
                    : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                }`}
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-semibold">
                  {user.avatar}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-gray-400">{user.role}</div>
                </div>
                {selectedUser === user.id && (
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={handleLogin}
            disabled={!selectedUser}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-all flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" />
            Sign In
          </button>

          <div className="mt-6 pt-6 border-t border-gray-800 text-center text-sm text-gray-400">
            Session-based authentication • Role-aware access
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          © 2026 Automotive Management Platform
        </div>
      </div>
    </div>
  );
}
