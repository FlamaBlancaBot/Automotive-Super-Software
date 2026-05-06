import { useState } from 'react';
import { FileText, Search, Filter } from 'lucide-react';
import { useNavigate } from 'react-router';

export default function JobSheets() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const jobSheets = [
    { id: 'JS-1001', jobId: 'J-1001', customer: 'John Smith', vehicle: '2024 Toyota Camry', technician: 'Mike T.', created: '2026-05-01', status: 'Completed' },
    { id: 'JS-1002', jobId: 'J-1002', customer: 'Sarah Johnson', vehicle: '2023 Honda Accord', technician: 'Sarah M.', created: '2026-05-02', status: 'In Progress' },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Job Sheets</h1>
          <p className="text-gray-400">Printable job sheets for technicians</p>
        </div>
      </div>

      <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search job sheets..." className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500" />
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
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Sheet ID</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Job ID</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Customer</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Vehicle</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Status</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobSheets.map((sheet) => (
              <tr key={sheet.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-all">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="font-medium">{sheet.id}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-400">{sheet.jobId}</td>
                <td className="px-6 py-4 font-medium">{sheet.customer}</td>
                <td className="px-6 py-4 text-gray-300">{sheet.vehicle}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    sheet.status === 'Completed' ? 'bg-green-900/30 text-green-300 border border-green-700/30' : 'bg-blue-900/30 text-blue-300 border border-blue-700/30'
                  }`}>
                    {sheet.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => navigate(`/job-sheets/${sheet.id}`)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-all">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
