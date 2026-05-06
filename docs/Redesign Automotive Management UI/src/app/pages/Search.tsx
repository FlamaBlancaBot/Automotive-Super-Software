import { useState } from 'react';
import { Search as SearchIcon, X, Car, FileText, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router';

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const results = [
    { type: 'job', id: 'J-1001', title: 'Oil Change Service', subtitle: 'John Smith • Toyota Camry', icon: Wrench, link: '/jobs/J-1001' },
    { type: 'quote', id: 'Q-2001', title: 'Brake Replacement Quote', subtitle: 'John Smith • $850', icon: FileText, link: '/quotes/Q-2001' },
    { type: 'vehicle', id: 'V-1001', title: '2024 Toyota Camry', subtitle: 'ABC-123 • John Smith', icon: Car, link: '/vehicles' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-all flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jobs, quotes, vehicles, customers..."
              className="w-full pl-14 pr-6 py-4 bg-[#0f1420] border border-gray-800 rounded-xl text-lg focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
        </div>

        <div className="bg-[#0f1420] border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <div className="text-sm text-gray-400">{results.length} results found</div>
          </div>

          <div className="divide-y divide-gray-800">
            {results.map((result) => {
              const Icon = result.icon;
              return (
                <button
                  key={result.id}
                  onClick={() => navigate(result.link)}
                  className="w-full p-6 hover:bg-gray-800/30 transition-all text-left flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="px-2 py-1 bg-gray-800 rounded text-xs font-medium text-gray-400">{result.id}</span>
                    </div>
                    <div className="font-medium mb-1">{result.title}</div>
                    <div className="text-sm text-gray-400">{result.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
