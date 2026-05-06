import { Outlet, useLocation, useNavigate, Link } from 'react-router';
import { Car, Users, Calendar, Wrench, FileText, Home, Settings, Bell, Search, Package, ClipboardList, Plus, LogOut, DollarSign } from 'lucide-react';
import { useState } from 'react';

export default function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications] = useState(3);

  const navItems = [
    { id: 'dashboard', path: '/', icon: Home, label: 'Dashboard' },
    { id: 'intake', path: '/intake', icon: Plus, label: 'New Booking' },
    { id: 'vehicles', path: '/vehicles', icon: Car, label: 'Vehicles' },
    { id: 'jobs', path: '/jobs', icon: Wrench, label: 'Jobs' },
    { id: 'quotes', path: '/quotes', icon: FileText, label: 'Quotes' },
    { id: 'invoices', path: '/invoices', icon: DollarSign, label: 'Invoices' },
    { id: 'parts', path: '/parts', icon: Package, label: 'Parts' },
    { id: 'mot', path: '/mot', icon: ClipboardList, label: 'MOT' },
    { id: 'job-sheets', path: '/job-sheets', icon: FileText, label: 'Job Sheets' },
    { id: 'technicians', path: '/technicians', icon: Users, label: 'Technicians' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-[#0a0e1a] text-gray-100">
      {/* Sidebar */}
      <div className="w-20 bg-[#0f1420] border-r border-gray-800 flex flex-col items-center py-6">
        {/* Logo */}
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-8 cursor-pointer" onClick={() => navigate('/')}>
          <Car className="w-6 h-6 text-white" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-4 w-full px-3 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              className={`w-full h-12 rounded-xl flex items-center justify-center transition-all group relative flex-shrink-0 ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800/30 hover:bg-gray-700/50 text-gray-400 hover:text-white'
              }`}
              title={item.label}
            >
              <item.icon className="w-5 h-5" />
              <span className="absolute left-full ml-4 px-3 py-1.5 bg-gray-900 text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50">
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        {/* Settings */}
        <Link
          to="/settings"
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all mt-4 ${
            isActive('/settings')
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800/30 hover:bg-gray-700/50 text-gray-400 hover:text-white'
          }`}
        >
          <Settings className="w-5 h-5" />
        </Link>

        {/* Logout */}
        <button
          onClick={() => navigate('/login')}
          className="w-12 h-12 rounded-xl bg-gray-800/30 hover:bg-red-600/20 hover:text-red-400 flex items-center justify-center text-gray-400 transition-all mt-2"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="h-16 bg-[#0f1420] border-b border-gray-800 px-8 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Automotive Management</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Button */}
            <button
              onClick={() => navigate('/search')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-700/50 transition-all"
            >
              <Search className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">Search...</span>
              <kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs">⌘K</kbd>
            </button>

            {/* Notifications */}
            <button className="relative w-10 h-10 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center">
              <Bell className="w-5 h-5 text-gray-400" />
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
                  {notifications}
                </span>
              )}
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-3 pl-4 border-l border-gray-700">
              <div className="text-right">
                <div className="text-sm">Admin User</div>
                <div className="text-xs text-gray-400">Manager</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                AU
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
