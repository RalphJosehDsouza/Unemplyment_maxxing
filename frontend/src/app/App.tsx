import { Routes, Route, Navigate } from 'react-router';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import Drivers from './pages/Drivers';
import Trips from './pages/Trips';
import Fuel from './pages/Fuel';
import Reports from './pages/Reports';
import DispatchAdvisor from './pages/DispatchAdvisor';
import Layout from './components/Layout';
import { ProtectedRoute } from '../components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />

          <Route element={<ProtectedRoute allowedRoles={['FLEET_MANAGER']} />}>
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/dispatch" element={<DispatchAdvisor />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['FLEET_MANAGER', 'SAFETY_OFFICER']} />}>
            <Route path="/drivers" element={<Drivers />} />
          </Route>

          <Route path="/trips" element={<Trips />} />

          <Route element={<ProtectedRoute allowedRoles={['FLEET_MANAGER', 'FINANCIAL_ANALYST']} />}>
            <Route path="/fuel" element={<Fuel />} />
            <Route path="/reports" element={<Reports />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
