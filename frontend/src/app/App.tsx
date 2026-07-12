import { Routes, Route, Navigate } from 'react-router';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { ProtectedRoute } from '../components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Role-specific placeholders */}
        <Route element={<ProtectedRoute allowedRoles={['Fleet Manager']} />}>
          <Route path="/vehicles" element={<Dashboard />} />
          <Route path="/maintenance" element={<Dashboard />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['Dispatcher']} />}>
          <Route path="/trips" element={<Dashboard />} />
        </Route>
      </Route>
    </Routes>
  );
}
