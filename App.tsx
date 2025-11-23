import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { isAuthenticated } from './services/authService';

// Lazy Load Components for Performance
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const StudentsView = React.lazy(() => import('./components/StudentsView'));
const AssignmentsView = React.lazy(() => import('./components/AssignmentsView'));
const PaymentsView = React.lazy(() => import('./components/PaymentsView'));
const WritersView = React.lazy(() => import('./components/WritersView'));
const SettingsView = React.lazy(() => import('./components/SettingsView'));
const LoginView = React.lazy(() => import('./components/LoginView'));

// Loading Fallback
const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      <p className="text-sm font-medium text-slate-400 animate-pulse">Loading TaskMaster...</p>
    </div>
  </div>
);

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/login" element={<LoginView />} />

            {/* Protected Routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/students" element={
              <ProtectedRoute>
                <Layout>
                  <StudentsView />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/assignments" element={
              <ProtectedRoute>
                <Layout>
                  <AssignmentsView />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/payments" element={
              <ProtectedRoute>
                <Layout>
                  <PaymentsView />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/writers" element={
              <ProtectedRoute>
                <Layout>
                  <WritersView />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Layout>
                  <SettingsView />
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </Suspense>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;