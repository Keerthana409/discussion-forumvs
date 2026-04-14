import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Forum from './pages/Forum';
import { ToastProvider } from './context/ToastContext';

function App() {
  const [theme, setTheme] = useState(localStorage.getItem('nexus_theme') || 'light');

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('nexus_theme', newTheme);
  };

  const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('nexus_token');
    return token ? children : <Navigate to="/" />;
  };

  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route 
            path="/app" 
            element={
              <PrivateRoute>
                <Forum theme={theme} toggleTheme={toggleTheme} />
              </PrivateRoute>
            } 
          />
        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;
