import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

// We will build these components next!
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import DeptHeadDashboard from './pages/DeptHeadDashboard'
import SolverDashboard from './pages/SolverDashboard'
import RequestorDashboard from './pages/RequestorDashboard'

function App() {
  // Global state to track if a user is logged in
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('ticket_user')) || null);

  // Helper function to protect routes based on login status
  const ProtectedRoute = ({ children, allowedRoles }) => {
    if (!user) {
      return <Navigate to="/" replace />;
    }
    
    // Normalize user role and allowed roles for case-insensitive and space-insensitive comparison
    const rawUserRole = String(user.role || '').toLowerCase().replace(/\s+/g, '');
    const normalizedAllowed = allowedRoles ? allowedRoles.map(r => String(r).toLowerCase().replace(/\s+/g, '')) : [];
    
    // Map legacy roles and misspellings
    let finalUserRole = rawUserRole;
    if (rawUserRole === 'user' || rawUserRole === 'requester') finalUserRole = 'requestor';
    
    if (allowedRoles && !normalizedAllowed.includes(finalUserRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
    return children;
  };

  return (
    <Router>
      <div className="app-container">
        <Routes>
          {/* Public Login Route */}
          <Route path="/" element={<Login setUser={setUser} />} />

          {/* Admin Routes */}
          <Route path="/admin/*" element={
            <ProtectedRoute allowedRoles={['Admin', 'Super Admin', 'Audit']}>
              <AdminDashboard user={user} setUser={setUser} />
            </ProtectedRoute>
          } />

          {/* Dept Head Routes */}
          <Route path="/dept-head/*" element={
            <ProtectedRoute allowedRoles={['Dept. Head']}>
              <DeptHeadDashboard user={user} setUser={setUser} />
            </ProtectedRoute>
          } />

          {/* Solver Routes */}
          <Route path="/solver/*" element={
            <ProtectedRoute allowedRoles={['Solver', 'Dept. Head']}>
              <SolverDashboard user={user} setUser={setUser} />
            </ProtectedRoute>
          } />

          {/* Requestor Routes (Everyone can raise a ticket except strict solvers) */}
          <Route path="/requestor/*" element={
            <ProtectedRoute allowedRoles={['Requestor', 'Dept. Head']}>
              <RequestorDashboard user={user} setUser={setUser} />
            </ProtectedRoute>
          } />

        </Routes>
      </div>
    </Router>
  )
}

export default App