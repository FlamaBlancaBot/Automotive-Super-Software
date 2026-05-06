import { useState } from 'react';
import { Database, Lock, CheckCircle } from 'lucide-react';

export default function Setup() {
  const [token, setToken] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-[#0f1420] border border-gray-800 rounded-xl p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-center mb-2">Setup & Database Tools</h1>
          <p className="text-gray-400 text-center mb-6">This area requires authorization</p>
          <div className="space-y-4">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter setup token..."
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <button onClick={() => setToken === 'admin123' && setIsAuthorized(true)} className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all">
              Authorize
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-8">Setup & Database Tools</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-6 h-6 text-green-400" />
            <h2 className="text-lg font-semibold">Database Status</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span>Database Connected</span>
              </div>
              <span className="text-green-400 font-medium">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
