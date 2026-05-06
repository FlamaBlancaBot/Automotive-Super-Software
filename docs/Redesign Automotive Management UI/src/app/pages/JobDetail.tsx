import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, FileText, Activity } from 'lucide-react';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const job = {
    id: id || 'J-1001',
    customer: 'John Smith',
    vehicle: '2024 Toyota Camry ABC-123',
    service: 'Oil Change + Inspection',
    status: 'In Progress',
    technician: 'Mike Thompson',
    amount: '$250',
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/jobs')} className="w-10 h-10 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-all flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold mb-1">Job {job.id}</h1>
          <p className="text-gray-400">{job.service}</p>
        </div>
        <button onClick={() => navigate(`/quotes/new?jobId=${job.id}`)} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Create Quote
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-6">Job Information</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-gray-400 mb-1">Status</div>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-900/30 text-blue-300 border border-blue-700/30">
                  {job.status}
                </span>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Technician</div>
                <div className="font-medium">{job.technician}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Customer</div>
                <div className="font-medium">{job.customer}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Vehicle</div>
                <div className="font-medium">{job.vehicle}</div>
              </div>
            </div>
          </div>

          <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-6 h-6 text-blue-400" />
              <h2 className="text-lg font-semibold">Activity Timeline</h2>
            </div>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                <div className="flex-1">
                  <div className="text-sm text-gray-300">Job status updated to In Progress</div>
                  <div className="text-xs text-gray-500 mt-1">2026-05-04 11:30 AM • Mike T.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button onClick={() => navigate(`/quotes/new?jobId=${job.id}`)} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all">
                Create Quote
              </button>
              <button onClick={() => navigate(`/job-sheets/${job.id}`)} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 hover:bg-gray-700 rounded-lg transition-all">
                View Job Sheet
              </button>
              <button onClick={() => navigate(`/invoices/${job.id}`)} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 hover:bg-gray-700 rounded-lg transition-all">
                Create Invoice
              </button>
            </div>
          </div>

          <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
            <h3 className="font-semibold mb-4">Financial Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Labor</span>
                <span className="font-medium">$150</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Parts</span>
                <span className="font-medium">$75</span>
              </div>
              <div className="pt-3 border-t border-gray-800 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-semibold text-green-400">{job.amount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
