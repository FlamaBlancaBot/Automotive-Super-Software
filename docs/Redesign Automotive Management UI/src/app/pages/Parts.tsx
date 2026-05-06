import { useState } from 'react';
import { Package, Search, Plus, Filter } from 'lucide-react';

export default function Parts() {
  const [searchQuery, setSearchQuery] = useState('');
  const parts = [
    { id: 'PO-3001', supplier: 'AutoParts Direct', part: 'Brake Pads (Front)', quantity: 2, status: 'Ordered', amount: '$180', expected: '2026-05-05' },
    { id: 'PO-3002', supplier: 'Premium Parts Co', part: 'Oil Filter + Oil', quantity: 1, status: 'Received', amount: '$65', expected: '2026-05-02' },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Parts Orders</h1>
          <p className="text-gray-400">Manage parts ordering and inventory</p>
        </div>
        <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center gap-2">
          <Plus className="w-5 h-5" />
          New Order
        </button>
      </div>

      <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search parts..." className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500" />
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
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Order ID</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Part</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Supplier</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Status</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Amount</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part) => (
              <tr key={part.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-all">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div className="font-medium">{part.id}</div>
                  </div>
                </td>
                <td className="px-6 py-4 font-medium">{part.part}</td>
                <td className="px-6 py-4 text-gray-300">{part.supplier}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    part.status === 'Received' ? 'bg-green-900/30 text-green-300 border border-green-700/30' : 'bg-blue-900/30 text-blue-300 border border-blue-700/30'
                  }`}>
                    {part.status}
                  </span>
                </td>
                <td className="px-6 py-4 font-medium text-green-400">{part.amount}</td>
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
