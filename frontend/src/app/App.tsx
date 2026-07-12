import { Routes, Route, Navigate } from 'react-router';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import Drivers from './pages/Drivers';
import Trips from './pages/Trips';
import Maintenance from './pages/Maintenance';
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
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['FLEET_MANAGER', 'SAFETY_OFFICER']} />}>
            <Route path="/drivers" element={<Drivers />} />
          </Route>

          <Route path="/trips" element={<Trips />} />

          <Route element={<ProtectedRoute allowedRoles={['FLEET_MANAGER']} />}>
            <Route path="/maintenance" element={<Maintenance />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
