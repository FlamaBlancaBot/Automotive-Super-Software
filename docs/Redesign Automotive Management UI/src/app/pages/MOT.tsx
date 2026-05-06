import { useState } from 'react';
import { ClipboardList, Search, Filter, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router';

export default function MOT() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const motEvents = [
    { id: 'MOT-001', vehicle: '2024 Toyota Camry ABC-123', customer: 'John Smith', testDate: '2026-04-28', result: 'Pass', advisories: 0 },
    { id: 'MOT-002', vehicle: '2023 Honda Accord XYZ-789', customer: 'Sarah Johnson', testDate: '2026-05-01', result: 'Fail', advisories: 3 },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2">MOT Events</h1>
          <p className="text-gray-400">Track MOT tests and results</p>
        </div>
        <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
          Check MOT Result
        </button>
      </div>

      <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search MOT..." className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500" />
          </div>
          <button className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-all flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </button>
        </div>
      </div>

      <div className="bg-[#0f1420] border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800/50 border-b border-gray-800">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">MOT ID</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Vehicle</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Customer</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Test Date</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Result</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {motEvents.map((mot) => (
              <tr key={mot.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-all">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${mot.result === 'Pass' ? 'from-green-600 to-emerald-600' : 'from-red-600 to-rose-600'} rounded-lg flex items-center justify-center`}>
                      {mot.result === 'Pass' ? <CheckCircle className="w-5 h-5 text-white" /> : <XCircle className="w-5 h-5 text-white" />}
                    </div>
                    <div className="font-medium">{mot.id}</div>
                  </div>
                </td>
                <td className="px-6 py-4 font-medium">{mot.vehicle}</td>
                <td className="px-6 py-4 text-gray-300">{mot.customer}</td>
                <td className="px-6 py-4 text-gray-300">{mot.testDate}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    mot.result === 'Pass' ? 'bg-green-900/30 text-green-300 border border-green-700/30' : 'bg-red-900/30 text-red-300 border border-red-700/30'
                  }`}>
                    {mot.result}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-all">
                      View Details
                    </button>
                    {mot.result === 'Fail' && (
                      <button onClick={() => navigate('/quotes/new')} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm transition-all">
                        Create Quote
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
