import { useState } from 'react';
import { Car, FileText, Package, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router';

type TabType = 'overview' | 'calendar' | 'kanban';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const navigate = useNavigate();

  const stats = [
    { label: 'Active Jobs', value: '24', change: '+5', icon: Car, color: 'blue', link: '/jobs' },
    { label: 'Pending Quotes', value: '12', change: '+3', icon: FileText, color: 'purple', link: '/quotes' },
    { label: 'Parts Orders', value: '8', change: '+2', icon: Package, color: 'green', link: '/parts' },
    { label: 'MOT Due This Week', value: '15', change: '+7', icon: CheckCircle, color: 'orange', link: '/mot' },
  ];

  const recentJobs = [
    { id: 'J-1001', customer: 'John Smith', vehicle: '2024 Toyota Camry', status: 'In Progress', technician: 'Mike T.' },
    { id: 'J-1002', customer: 'Sarah Johnson', vehicle: '2023 Honda Accord', status: 'Waiting Parts', technician: 'Sarah M.' },
    { id: 'J-1003', customer: 'Mike Williams', vehicle: '2025 Ford F-150', status: 'Quote Pending', technician: 'Unassigned' },
    { id: 'J-1004', customer: 'Emily Davis', vehicle: '2024 Tesla Model 3', status: 'Scheduled', technician: 'John D.' },
  ];

  const alerts = [
    { id: 1, message: 'Low inventory: Engine oil (5W-30)', severity: 'warning' },
    { id: 2, message: 'Service bay 3 maintenance due tomorrow', severity: 'info' },
    { id: 3, message: '3 quotes pending customer approval', severity: 'alert' },
  ];

  return (
    <div className="p-8">
      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-gray-800">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'calendar', label: 'Calendar View' },
          { id: 'kanban', label: 'Kanban Board' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-6 py-3 font-medium transition-all ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-6">
            {stats.map((stat) => {
              const Icon = stat.icon;
              const colorClasses = {
                blue: 'from-blue-600 to-blue-700',
                purple: 'from-purple-600 to-purple-700',
                green: 'from-green-600 to-green-700',
                orange: 'from-orange-600 to-orange-700',
              };

              return (
                <button
                  key={stat.label}
                  onClick={() => navigate(stat.link)}
                  className="bg-[#0f1420] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-all text-left"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${colorClasses[stat.color as keyof typeof colorClasses]} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center gap-1 text-green-400 text-sm">
                      <TrendingUp className="w-4 h-4" />
                      {stat.change}
                    </div>
                  </div>
                  <div className="text-3xl font-bold mb-1">{stat.value}</div>
                  <div className="text-sm text-gray-400">{stat.label}</div>
                </button>
              );
            })}
          </div>

          {/* Service Bay Status */}
          <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-6">Service Bay Status</h3>
            <div className="grid grid-cols-6 gap-4">
              {[
                { bay: 1, status: 'In Use', vehicle: 'Camry', job: 'J-1001' },
                { bay: 2, status: 'Available', vehicle: null, job: null },
                { bay: 3, status: 'In Use', vehicle: 'Accord', job: 'J-1002' },
                { bay: 4, status: 'Available', vehicle: null, job: null },
                { bay: 5, status: 'Cleaning', vehicle: null, job: null },
                { bay: 6, status: 'Available', vehicle: null, job: null },
              ].map((bay) => (
                <div
                  key={bay.bay}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    bay.status === 'In Use'
                      ? 'border-blue-500 bg-blue-900/20 hover:bg-blue-900/30'
                      : bay.status === 'Cleaning'
                      ? 'border-orange-500 bg-orange-900/20 hover:bg-orange-900/30'
                      : 'border-gray-700 bg-gray-800/20 hover:bg-gray-700/30'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-1">Bay {bay.bay}</div>
                    <div className={`text-xs mb-2 ${
                      bay.status === 'In Use' ? 'text-blue-400' :
                      bay.status === 'Cleaning' ? 'text-orange-400' :
                      'text-gray-400'
                    }`}>
                      {bay.status}
                    </div>
                    {bay.vehicle && (
                      <div className="text-xs text-gray-500">
                        {bay.vehicle}
                        <div className="text-gray-600">{bay.job}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-3 gap-6">
            {/* Recent Jobs */}
            <div className="col-span-2 bg-[#0f1420] border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Recent Jobs</h3>
                <button
                  onClick={() => navigate('/jobs')}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  View All
                </button>
              </div>

              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="w-full flex items-center gap-4 p-4 bg-gray-800/30 hover:bg-gray-800/50 rounded-lg transition-all text-left"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-sm font-medium">
                      {job.id.split('-')[1]}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{job.customer}</div>
                      <div className="text-sm text-gray-400">{job.vehicle}</div>
                    </div>
                    <div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        job.status === 'In Progress'
                          ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50'
                          : job.status === 'Waiting Parts'
                          ? 'bg-orange-900/50 text-orange-300 border border-orange-700/50'
                          : 'bg-gray-700/50 text-gray-300 border border-gray-600/50'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Alerts & Quick Stats */}
            <div className="space-y-6">
              <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-6">Alerts</h3>
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-lg border ${
                        alert.severity === 'warning'
                          ? 'bg-yellow-900/20 border-yellow-700/30'
                          : alert.severity === 'alert'
                          ? 'bg-red-900/20 border-red-700/30'
                          : 'bg-blue-900/20 border-blue-700/30'
                      }`}
                    >
                      <div className="flex gap-3">
                        <AlertCircle className={`w-5 h-5 flex-shrink-0 ${
                          alert.severity === 'warning'
                            ? 'text-yellow-400'
                            : alert.severity === 'alert'
                            ? 'text-red-400'
                            : 'text-blue-400'
                        }`} />
                        <div className="text-sm">{alert.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
                <h4 className="font-medium mb-4">Performance</h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Capacity</span>
                      <span className="font-medium">72%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full" style={{ width: '72%' }} />
                    </div>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Revenue Today</span>
                    <span className="font-medium text-green-400">$5,240</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Avg. Job Time</span>
                    <span className="font-medium">2.4hrs</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Customer Rating</span>
                    <span className="font-medium text-yellow-400">4.8 ⭐</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
                <h4 className="font-medium mb-4">Upcoming</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">2:00 PM - Oil Change</div>
                      <div className="text-xs text-gray-400">Emily Davis</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                    <div className="w-2 h-2 bg-purple-500 rounded-full" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">3:30 PM - Inspection</div>
                      <div className="text-xs text-gray-400">Mike Brown</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-semibold">Calendar View</h2>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-all">Today</button>
              <button className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-all">Month</button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-gray-400 pb-2">{day}</div>
            ))}
            {Array.from({ length: 35 }).map((_, i) => {
              const hasEvent = [3, 5, 8, 12, 15, 18, 22, 25].includes(i);
              return (
                <div
                  key={i}
                  className={`aspect-square border border-gray-800 rounded-lg p-2 ${hasEvent ? 'bg-blue-900/20 border-blue-700/30' : 'bg-gray-800/20'} hover:bg-gray-700/30 transition-all cursor-pointer`}
                >
                  <div className="text-sm font-medium">{i + 1}</div>
                  {hasEvent && <div className="mt-1 text-xs text-blue-400">3 bookings</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kanban Tab */}
      {activeTab === 'kanban' && (
        <div className="grid grid-cols-5 gap-6">
          {['Scheduled', 'In Progress', 'Waiting Parts', 'Quality Check', 'Completed'].map((status) => (
            <div key={status} className="bg-[#0f1420] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{status}</h3>
                <span className="px-2 py-1 bg-gray-800 rounded-full text-xs">
                  {status === 'In Progress' ? '4' : status === 'Scheduled' ? '6' : '2'}
                </span>
              </div>

              <div className="space-y-3">
                {(status === 'In Progress' ? recentJobs.slice(0, 2) : recentJobs.slice(0, 1)).map((job) => (
                  <button
                    key={job.id}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="w-full p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-all text-left border border-gray-700"
                  >
                    <div className="font-medium text-sm mb-1">{job.id}</div>
                    <div className="text-xs text-gray-400 mb-2">{job.customer}</div>
                    <div className="text-xs text-gray-500">{job.vehicle}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
