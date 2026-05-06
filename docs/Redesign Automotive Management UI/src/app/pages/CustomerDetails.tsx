import { useParams } from 'react-router';
import { useState } from 'react';
import { CheckCircle, User } from 'lucide-react';

export default function CustomerDetails() {
  const { token } = useParams();
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex w-20 h-20 bg-gradient-to-br from-green-600 to-emerald-600 rounded-full items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Thank You!</h1>
          <p className="text-gray-400">Your details have been submitted successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl items-center justify-center mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Customer Details Form</h1>
          <p className="text-gray-400">Please provide your contact information</p>
        </div>

        <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-8">
          <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">First Name *</label>
                <input required type="text" className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Last Name *</label>
                <input required type="text" className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email *</label>
              <input required type="email" className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500" />
            </div>
            <button type="submit" className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-medium transition-all">
              Submit Details
            </button>
          </form>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          Reference Token: <span className="font-mono text-blue-400">{token}</span>
        </div>
      </div>
    </div>
  );
}
