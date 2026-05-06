import { useState } from 'react';
import { Building2, Users, Wrench, FileText, Database, Palette } from 'lucide-react';

type SettingsTab = 'company' | 'technicians' | 'services' | 'templates' | 'integrations' | 'preferences';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');

  const tabs = [
    { id: 'company', label: 'Company Settings', icon: Building2 },
    { id: 'technicians', label: 'Technicians', icon: Users },
    { id: 'services', label: 'Service Templates', icon: Wrench },
    { id: 'templates', label: 'Document Templates', icon: FileText },
    { id: 'integrations', label: 'Integrations', icon: Database },
    { id: 'preferences', label: 'Preferences', icon: Palette },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">Settings</h1>
        <p className="text-gray-400">Manage your platform configuration</p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-4">
          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="col-span-3 bg-[#0f1420] border border-gray-800 rounded-xl p-8">
          {activeTab === 'company' && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Company Settings</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Company Name</label>
                  <input type="text" defaultValue="Auto Shop" className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500" />
                </div>
                <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all">Save Changes</button>
              </div>
            </div>
          )}
          {activeTab !== 'company' && (
            <div className="text-center text-gray-400 py-12">
              {tabs.find(t => t.id === activeTab)?.label} settings
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
