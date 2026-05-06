import { createBrowserRouter } from 'react-router';
import RootLayout from './layouts/RootLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Intake from './pages/Intake';
import Search from './pages/Search';
import Vehicles from './pages/Vehicles';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import Quotes from './pages/Quotes';
import QuoteDetail from './pages/QuoteDetail';
import Parts from './pages/Parts';
import MOT from './pages/MOT';
import JobSheets from './pages/JobSheets';
import JobSheetDetail from './pages/JobSheetDetail';
import InvoiceDetail from './pages/InvoiceDetail';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import Setup from './pages/Setup';
import CustomerDetails from './pages/CustomerDetails';
import Technicians from './pages/Technicians';
import NotFound from './pages/NotFound';

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/customer-details/:token',
    Component: CustomerDetails,
  },
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'intake', Component: Intake },
      { path: 'search', Component: Search },
      { path: 'vehicles', Component: Vehicles },
      { path: 'jobs', Component: Jobs },
      { path: 'jobs/:id', Component: JobDetail },
      { path: 'quotes', Component: Quotes },
      { path: 'quotes/:id', Component: QuoteDetail },
      { path: 'parts', Component: Parts },
      { path: 'mot', Component: MOT },
      { path: 'job-sheets', Component: JobSheets },
      { path: 'job-sheets/:id', Component: JobSheetDetail },
      { path: 'invoices', Component: Invoices },
      { path: 'invoices/:id', Component: InvoiceDetail },
      { path: 'technicians', Component: Technicians },
      { path: 'settings', Component: Settings },
      { path: 'setup', Component: Setup },
      { path: '*', Component: NotFound },
    ],
  },
]);
