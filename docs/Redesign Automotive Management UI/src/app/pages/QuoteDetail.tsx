import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Download, Send } from 'lucide-react';
import { useState } from 'react';

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Pending');

  const quote = {
    id: id || 'Q-2001',
    jobId: 'J-1001',
    customer: 'John Smith',
    vehicle: '2024 Toyota Camry ABC-123',
  };

  const lineItems = [
    { id: 1, name: 'Brake Pads (Front)', quantity: 2, unitPrice: 85, total: 170 },
    { id: 2, name: 'Brake Installation Labor', quantity: 1, unitPrice: 180, total: 180 },
  ];

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/quotes')} className="w-10 h-10 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-all flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold mb-1">Quote {quote.id}</h1>
          <p className="text-gray-400">Job: {quote.jobId} • {quote.customer}</p>
        </div>
        <button className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-all flex items-center gap-2">
          <Download className="w-5 h-5" />
          Download PDF
        </button>
        <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-2">
          <Send className="w-5 h-5" />
          Send to Customer
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-[#0f1420] border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-6">Line Items</h2>

          <table className="w-full">
            <thead className="border-b border-gray-800">
              <tr>
                <th className="text-left pb-3 text-sm font-medium text-gray-400">Item</th>
                <th className="text-right pb-3 text-sm font-medium text-gray-400">Qty</th>
                <th className="text-right pb-3 text-sm font-medium text-gray-400">Unit Price</th>
                <th className="text-right pb-3 text-sm font-medium text-gray-400">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.id} className="border-b border-gray-800">
                  <td className="py-4 font-medium">{item.name}</td>
                  <td className="py-4 text-right">{item.quantity}</td>
                  <td className="py-4 text-right">${item.unitPrice}</td>
                  <td className="py-4 text-right font-medium">${item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 pt-6 border-t border-gray-800 flex justify-end">
            <div className="w-80 space-y-3">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Tax (15%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-3 border-t border-gray-800">
                <span>Total</span>
                <span className="text-green-400">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
            <h3 className="font-semibold mb-4">Quote Status</h3>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500">
              <option>Pending</option>
              <option>Accepted</option>
              <option>Rejected</option>
            </select>
          </div>

          <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button onClick={() => navigate('/parts')} className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-all">
                Create Parts Order
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
