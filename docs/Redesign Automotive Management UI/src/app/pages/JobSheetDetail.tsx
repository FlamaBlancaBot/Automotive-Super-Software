import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Printer } from 'lucide-react';

export default function JobSheetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8 print:hidden">
        <button onClick={() => navigate('/job-sheets')} className="w-10 h-10 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-all flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Job Sheet {id}</h1>
        </div>
        <button onClick={() => window.print()} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-2">
          <Printer className="w-5 h-5" />
          Print
        </button>
      </div>

      <div className="bg-white text-black p-12 rounded-xl max-w-4xl mx-auto">
        <div className="border-b-2 border-gray-300 pb-6 mb-6">
          <h1 className="text-3xl font-bold mb-2">JOB SHEET</h1>
          <div className="text-lg">Sheet #{id}</div>
        </div>
        <div className="text-center text-gray-600 py-8">
          Printable job sheet content
        </div>
      </div>
    </div>
  );
}
