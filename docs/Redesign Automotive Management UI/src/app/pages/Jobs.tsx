import { useState } from 'react';
import { Wrench, Search, Plus, Filter } from 'lucide-react';
import { useNavigate } from 'react-router';

export default function Jobs() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const jobs = [
    { id: 'J-1001', customer: 'John Smith', vehicle: '2024 Toyota Camry ABC-123', service: 'Oil Change', status: 'In Progress', technician: 'Mike T.', amount: '$250' },
    { id: 'J-1002', customer: 'Sarah Johnson', vehicle: '2023 Honda Accord XYZ-789', service: 'Brake Service', status: 'Waiting Parts', technician: 'Sarah M.', amount: '$480' },
    { id: 'J-1003', customer: 'Mike Williams', vehicle: '2025 Ford F-150 DEF-456', service: 'Tire Rotation', status: 'Quote Pending', technician: 'Unassigned', amount: '$120' },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Jobs</h1>
          <p className="text-gray-400">Manage all service jobs</p>
        </div>
        <button
          onClick={() => navigate('/intake')}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-medium transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Job
        </button>
      </div>

      <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by job ID, customer, vehicle..."
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
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
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Job ID</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Customer</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Vehicle</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Service</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Status</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Amount</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-all">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                      <Wrench className="w-5 h-5 text-white" />
                    </div>
                    <div className="font-medium">{job.id}</div>
                  </div>
                </td>
                <td className="px-6 py-4 font-medium">{job.customer}</td>
                <td className="px-6 py-4 text-gray-300">{job.vehicle}</td>
                <td className="px-6 py-4 text-gray-300">{job.service}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    job.status === 'In Progress' ? 'bg-blue-900/30 text-blue-300 border border-blue-700/30' :
                    job.status === 'Waiting Parts' ? 'bg-orange-900/30 text-orange-300 border border-orange-700/30' :
                    'bg-gray-700/30 text-gray-300 border border-gray-600/30'
                  }`}>
                    {job.status}
                  </span>
                </td>
                <td className="px-6 py-4 font-medium text-green-400">{job.amount}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-all"
                  >
                    View Details
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
