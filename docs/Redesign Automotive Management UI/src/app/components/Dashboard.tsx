import { Car, Users, Calendar, TrendingUp, Clock, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const stats = [
    { label: 'Total Vehicles', value: '248', change: '+12%', icon: Car, color: 'blue' },
    { label: 'Active Customers', value: '1,432', change: '+8%', icon: Users, color: 'purple' },
    { label: 'Scheduled Today', value: '18', change: '+3', icon: Calendar, color: 'green' },
    { label: 'Avg. Service Time', value: '2.4h', change: '-15min', icon: Clock, color: 'orange' },
  ];

  const recentBookings = [
    { id: 1, customer: 'John Smith', vehicle: '2024 Toyota Camry', service: 'Oil Change', time: '09:00 AM', status: 'In Progress' },
    { id: 2, customer: 'Sarah Johnson', vehicle: '2023 Honda Accord', service: 'Brake Service', time: '10:30 AM', status: 'Scheduled' },
    { id: 3, customer: 'Mike Williams', vehicle: '2025 Ford F-150', service: 'Tire Rotation', time: '11:00 AM', status: 'Scheduled' },
    { id: 4, customer: 'Emily Davis', vehicle: '2024 Tesla Model 3', service: 'Diagnostics', time: '01:30 PM', status: 'Scheduled' },
    { id: 5, customer: 'David Brown', vehicle: '2023 BMW X5', service: 'General Inspection', time: '03:00 PM', status: 'Scheduled' },
  ];

  const alerts = [
    { id: 1, message: 'Low inventory: Engine oil (5W-30)', severity: 'warning' },
    { id: 2, message: 'Service bay 3 maintenance due tomorrow', severity: 'info' },
    { id: 3, message: 'Customer follow-up required: John Smith', severity: 'alert' },
  ];

  return (
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
            <div key={stat.label} className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
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
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Recent Bookings */}
        <div className="col-span-2 bg-[#0f1420] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Today's Schedule</h3>
            <button className="text-sm text-blue-400 hover:text-blue-300">View All</button>
          </div>

          <div className="space-y-3">
            {recentBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center gap-4 p-4 bg-gray-800/30 hover:bg-gray-800/50 rounded-lg transition-all cursor-pointer"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-sm font-medium">
                  {booking.customer.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{booking.customer}</div>
                  <div className="text-sm text-gray-400">{booking.vehicle}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{booking.service}</div>
                  <div className="text-xs text-gray-400">{booking.time}</div>
                </div>
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    booking.status === 'In Progress'
                      ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50'
                      : 'bg-gray-700/50 text-gray-300 border border-gray-600/50'
                  }`}>
                    {booking.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts & Notifications */}
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

          <div className="mt-6 pt-6 border-t border-gray-800">
            <h4 className="font-medium mb-4">Quick Stats</h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Capacity Today</span>
                <span className="font-medium">68%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full" style={{ width: '68%' }} />
              </div>

              <div className="flex justify-between text-sm pt-2">
                <span className="text-gray-400">Revenue (Today)</span>
                <span className="font-medium text-green-400">$4,250</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Avg. Rating</span>
                <span className="font-medium">4.8 ⭐</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Service Bay Status */}
      <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-6">Service Bay Status</h3>
        <div className="grid grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((bay) => (
            <div
              key={bay}
              className={`p-4 rounded-lg border-2 ${
                bay === 1 || bay === 3
                  ? 'border-blue-500 bg-blue-900/20'
                  : bay === 5
                  ? 'border-orange-500 bg-orange-900/20'
                  : 'border-gray-700 bg-gray-800/20'
              }`}
            >
              <div className="text-center">
                <div className="text-2xl font-bold mb-1">Bay {bay}</div>
                <div className="text-xs text-gray-400">
                  {bay === 1 || bay === 3 ? 'In Use' : bay === 5 ? 'Cleaning' : 'Available'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
