import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { useState } from 'react';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Unpaid');

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8 print:hidden">
        <button onClick={() => navigate('/invoices')} className="w-10 h-10 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-all flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Invoice {id}</h1>
        </div>
        <button className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-all flex items-center gap-2">
          <Download className="w-5 h-5" />
          Download PDF
        </button>
        <button onClick={() => window.print()} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-2">
          <Printer className="w-5 h-5" />
          Print
        </button>
      </div>

      <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6 mb-6 print:hidden">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">Invoice Status:</div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500">
            <option>Unpaid</option>
            <option>Paid</option>
            <option>Overdue</option>
          </select>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all">Update Status</button>
        </div>
      </div>

      <div className="bg-white text-black p-12 rounded-xl max-w-4xl mx-auto">
        <div className="border-b-2 border-gray-300 pb-6 mb-8">
          <div className="flex justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-blue-600">INVOICE</h1>
              <div className="text-lg">#{id}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">AUTO SHOP</div>
              <div className="text-sm mt-2">123 Service Lane<br/>City, State 12345</div>
            </div>
          </div>
        </div>
        <div className="text-center text-gray-600 py-8">
          Printable invoice content with line items and totals
        </div>
      </div>
    </div>
  );
}
