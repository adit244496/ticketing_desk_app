import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

// We will build these components next!
import Login from './pages/Login.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import DeptHeadDashboard from './pages/DeptHeadDashboard.jsx'
import SolverDashboard from './pages/SolverDashboard.jsx'
import RequestorDashboard from './pages/RequestorDashboard.jsx'

function App() {
  // Global state to track if a user is logged in
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('ticket_user')) || null);

  // Helper function to protect routes based on login status
  const ProtectedRoute = ({ children, allowedRoles }) => {
    if (!user) {
      return <Navigate to="/" replace />;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
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
            <ProtectedRoute allowedRoles={['Admin']}>
              <AdminDashboard user={user} setUser={setUser} />
            </ProtectedRoute>
          } />

          {/* Dept Head Routes */}
          <Route path="/dept-head/*" element={
            <ProtectedRoute allowedRoles={['Dept. Head', 'Admin']}>
              <DeptHeadDashboard user={user} setUser={setUser} />
            </ProtectedRoute>
          } />

          {/* Solver Routes */}
          <Route path="/solver/*" element={
            <ProtectedRoute allowedRoles={['Solver', 'Dept. Head', 'Admin']}>
              <SolverDashboard user={user} setUser={setUser} />
            </ProtectedRoute>
          } />

          {/* Requestor Routes (Everyone can raise a ticket except strict solvers) */}
          <Route path="/requestor/*" element={
            <ProtectedRoute allowedRoles={['Requestor', 'Dept. Head', 'Admin']}>
              <RequestorDashboard user={user} setUser={setUser} />
            </ProtectedRoute>
          } />

        </Routes>
      </div>
    </Router>
  )
}

export default App