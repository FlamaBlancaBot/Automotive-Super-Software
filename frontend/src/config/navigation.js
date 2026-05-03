// Placeholder navigation for the app shell.
//
// These are not real pages yet. For now they help us:
// - agree the main sections of the system
// - build a consistent layout early

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', path: '/', title: 'Dashboard', icon: '🏠' },
  { key: 'new-intake', label: 'New Intake', path: '/intake', title: 'New Intake', icon: '📞' },
  { key: 'search', label: 'Search', path: '/search', title: 'Search', icon: '🔎' },
  { key: 'vehicles', label: 'Vehicles', path: '/vehicles', title: 'Vehicles', hidden: true, icon: '🚗' },
  { key: 'jobs', label: 'Jobs', path: '/jobs', title: 'Jobs', icon: '🧾' },
  { key: 'quotes', label: 'Quotes', path: '/quotes', title: 'Quotes', icon: '💷' },
  { key: 'parts', label: 'Parts', path: '/parts', title: 'Parts', icon: '🧩' },
  { key: 'suppliers', label: 'Suppliers', path: '/suppliers', title: 'Suppliers', icon: '🏭' },
  { key: 'technicians', label: 'Technicians', path: '/technicians', title: 'Technicians', icon: '🧑‍🔧' },
  { key: 'mot', label: 'MOT', path: '/mot', title: 'MOT', icon: '✅' },
  { key: 'job-sheets', label: 'Job Sheets', path: '/job-sheets', title: 'Job Sheets', icon: '📄' },
  { key: 'settings', label: 'Settings', path: '/settings', title: 'Settings', icon: '⚙️' },
  { key: 'setup', label: 'Set-up', path: '/setup', title: 'Setup', hidden: true, icon: '🛠️' },
]
