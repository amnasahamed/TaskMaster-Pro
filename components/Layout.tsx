import React, { useState, createContext, useContext } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import ToastContainer, { ToastMessage, ToastType } from './ui/Toast';

// Toast Context Setup
interface ToastContextType {
  addToast: (message: string, type: ToastType) => void;
}
export const ToastContext = createContext<ToastContextType>({ addToast: () => {} });
export const useToast = () => useContext(ToastContext);

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: ToastType) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };
  
  const navItems = [
    { to: '/', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { to: '/students', label: 'Students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { to: '/assignments', label: 'Tasks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { to: '/payments', label: 'Payments', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { to: '/writers', label: 'Writers', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
  ];

  const getPageTitle = () => {
    switch(location.pathname) {
      case '/': return 'Dashboard';
      case '/students': return 'Students';
      case '/assignments': return 'Tasks';
      case '/payments': return 'Payments';
      case '/writers': return 'Writers';
      case '/settings': return 'Settings';
      default: return 'TaskMaster';
    }
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      <div className="min-h-screen bg-background text-slate-900 font-sans selection:bg-blue-100">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        
        {/* Desktop Header */}
        <header className="fixed top-0 inset-x-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200 hidden md:block">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                  <div className="flex-shrink-0 flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white font-bold shadow-sm">T</div>
                      <h1 className="text-xl font-bold tracking-tight text-slate-900">TaskMaster Pro</h1>
                  </div>
                  <nav className="flex space-x-8">
                      {navItems.map(item => (
                          <NavLink 
                              key={item.to} 
                              to={item.to}
                              className={({ isActive }) => `inline-flex items-center px-1 pt-1 text-sm font-semibold transition-colors ${isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                              {item.label}
                          </NavLink>
                      ))}
                  </nav>
              </div>
          </div>
        </header>

        {/* Mobile Header (Title Only) */}
        <header className="md:hidden sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-slate-200/50 px-4 h-14 flex items-center justify-center">
           <h1 className="text-lg font-bold text-slate-900">{getPageTitle()}</h1>
        </header>

        {/* Main Content */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:pt-24 pb-24 md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200/60 z-50 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5 h-14">
              {navItems.map(item => (
                  <NavLink 
                      key={item.to} 
                      to={item.to}
                      className={({ isActive }) => `flex flex-col items-center justify-center space-y-[2px] active:scale-90 transition-transform ${isActive ? 'text-primary' : 'text-slate-400'}`}
                  >
                      <svg className="w-6 h-6" fill={item.to === location.pathname ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                      <span className="text-[9px] font-medium">{item.label}</span>
                  </NavLink>
              ))}
          </div>
        </nav>
      </div>
    </ToastContext.Provider>
  );
};

export default Layout;