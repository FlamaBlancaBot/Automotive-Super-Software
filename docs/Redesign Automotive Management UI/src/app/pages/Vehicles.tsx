import { useState } from 'react';
import { Car, Search, Plus, Filter } from 'lucide-react';
import { useNavigate } from 'react-router';

export default function Vehicles() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const vehicles = [
    { id: 'V-1001', plate: 'ABC-123', make: 'Toyota', model: 'Camry', year: '2024', owner: 'John Smith', lastService: '2026-04-15', status: 'Active' },
    { id: 'V-1002', plate: 'XYZ-789', make: 'Honda', model: 'Accord', year: '2023', owner: 'Sarah Johnson', lastService: '2026-03-22', status: 'Active' },
    { id: 'V-1003', plate: 'DEF-456', make: 'Ford', model: 'F-150', year: '2025', owner: 'Mike Williams', lastService: '2026-04-01', status: 'Active' },
    { id: 'V-1004', plate: 'GHI-321', make: 'Tesla', model: 'Model 3', year: '2024', owner: 'Emily Davis', lastService: '2026-02-14', status: 'Active' },
    { id: 'V-1005', plate: 'JKL-654', make: 'BMW', model: 'X5', year: '2023', owner: 'David Brown', lastService: '2026-04-20', status: 'Inactive' },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Vehicles</h1>
          <p className="text-gray-400">Manage all registered vehicles</p>
        </div>
        <button
          onClick={() => navigate('/intake')}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-medium transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Vehicle
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
              placeholder="Search by plate, make, model, or owner..."
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
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">License Plate</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Vehicle</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Owner</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Last Service</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Status</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-all">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                      <Car className="w-5 h-5 text-white" />
                    </div>
                    <div className="font-medium">{vehicle.plate}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium">{vehicle.year} {vehicle.make} {vehicle.model}</div>
                  <div className="text-sm text-gray-400">{vehicle.id}</div>
                </td>
                <td className="px-6 py-4 text-gray-300">{vehicle.owner}</td>
                <td className="px-6 py-4 text-gray-300">{vehicle.lastService}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    vehicle.status === 'Active'
                      ? 'bg-green-900/30 text-green-300 border border-green-700/30'
                      : 'bg-gray-700/30 text-gray-300 border border-gray-600/30'
                  }`}>
                    {vehicle.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-all">
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
