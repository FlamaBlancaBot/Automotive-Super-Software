import { useState } from 'react';
import { FileText, Search, Plus, Filter } from 'lucide-react';
import { useNavigate } from 'react-router';

export default function Quotes() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const quotes = [
    { id: 'Q-2001', jobId: 'J-1001', customer: 'John Smith', vehicle: '2024 Toyota Camry', service: 'Brake Replacement', status: 'Pending', amount: '$850', validUntil: '2026-05-15' },
    { id: 'Q-2002', jobId: 'J-1002', customer: 'Sarah Johnson', vehicle: '2023 Honda Accord', service: 'Transmission Service', status: 'Accepted', amount: '$1,200', validUntil: '2026-05-12' },
    { id: 'Q-2003', jobId: 'J-1003', customer: 'Mike Williams', vehicle: '2025 Ford F-150', service: 'Engine Diagnostics', status: 'Pending', amount: '$450', validUntil: '2026-05-16' },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Quotes</h1>
          <p className="text-gray-400">Manage customer quotes and estimates</p>
        </div>
        <button onClick={() => navigate('/quotes/new')} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-medium transition-all flex items-center gap-2">
          <Plus className="w-5 h-5" />
          New Quote
        </button>
      </div>

      <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search quotes..." className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500" />
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
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Quote ID</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Customer</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Service</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Status</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Amount</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr key={quote.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-all">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="font-medium">{quote.id}</div>
                  </div>
                </td>
                <td className="px-6 py-4 font-medium">{quote.customer}</td>
                <td className="px-6 py-4 text-gray-300">{quote.service}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    quote.status === 'Accepted' ? 'bg-green-900/30 text-green-300 border border-green-700/30' :
                    quote.status === 'Pending' ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/30' :
                    'bg-gray-700/30 text-gray-300 border border-gray-600/30'
                  }`}>
                    {quote.status}
                  </span>
                </td>
                <td className="px-6 py-4 font-medium text-green-400">{quote.amount}</td>
                <td className="px-6 py-4">
                  <button onClick={() => navigate(`/quotes/${quote.id}`)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-all">
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
