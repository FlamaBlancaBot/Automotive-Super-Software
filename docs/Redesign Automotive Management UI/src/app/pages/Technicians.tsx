import { useState } from 'react';
import { Users, Search, Plus } from 'lucide-react';

export default function Technicians() {
  const [searchQuery, setSearchQuery] = useState('');
  const technicians = [
    { id: '1', name: 'Mike Thompson', role: 'Senior Technician', avatar: 'MT', activeJobs: 4, completedToday: 2 },
    { id: '2', name: 'Sarah Martinez', role: 'Technician', avatar: 'SM', activeJobs: 3, completedToday: 1 },
    { id: '3', name: 'John Davis', role: 'Junior Technician', avatar: 'JD', activeJobs: 2, completedToday: 3 },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Technicians</h1>
          <p className="text-gray-400">Manage technician records and assignments</p>
        </div>
        <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Technician
        </button>
      </div>

      <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search technicians..." className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {technicians.map((tech) => (
          <div key={tech.id} className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-xl font-semibold">
                {tech.avatar}
              </div>
              <div>
                <div className="font-semibold text-lg">{tech.name}</div>
                <div className="text-sm text-gray-400">{tech.role}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-400">{tech.activeJobs}</div>
                <div className="text-sm text-gray-400">Active Jobs</div>
              </div>
              <div className="bg-gray-800/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-400">{tech.completedToday}</div>
                <div className="text-sm text-gray-400">Completed Today</div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-all">
                View Schedule
              </button>
              <button className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 rounded-lg text-sm transition-all">
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
