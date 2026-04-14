import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Login = () => {
  const [activeTab, setActiveTab] = useState('login');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.id.split('-')[1]]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (activeTab === 'signup') {
      if (formData.name.trim().length < 4) {
        setError('Name must contain at least 4 letters.');
        return;
      }
      if (!/(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
        setError('Password must contain at least 1 capital letter and 1 number.');
        return;
      }
    }

    setIsLoading(true);

    try {
      let res;
      if (activeTab === 'signup') {
        res = await api.post('/auth/signup', {
          username: formData.name,
          email: formData.email,
          password: formData.password
        });
      } else {
        // Both standard login and admin utilize the same endpoints, admin checking happens visually or on the backend
        res = await api.post('/auth/login', {
          email: formData.email,
          password: formData.password
        });
      }

      localStorage.setItem('nexus_token', res.token);
      localStorage.setItem('nexus_user', JSON.stringify(res.user));
      navigate('/app');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePassword = () => setShowPassword(!showPassword);

  const resetFormAndError = (tab) => {
    setActiveTab(tab);
    setError('');
    setFormData({ name: '', email: '', password: '' });
  };

  return (
    <div className="auth-body auth-body-centered">
      <div className="auth-container centered-auth-card">
        <div className="auth-header">
          <i className="fa-solid fa-comments auth-logo-icon"></i>
          <h1>Discussion Forum</h1>
          <p>Welcome to Discussion Forum with Moderation Panel</p>
        </div>

        <div className="auth-tabs glass-tabs">
          <button 
            className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => resetFormAndError('login')}
          >
            Login
          </button>
          <button 
            className={`auth-tab ${activeTab === 'signup' ? 'active' : ''}`}
            onClick={() => resetFormAndError('signup')}
          >
            Sign Up
          </button>
          <button 
            className={`auth-tab ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => resetFormAndError('admin')}
          >
            Admin
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-box">
          {activeTab === 'signup' && (
            <div className="form-group slim-form-group">
              <label htmlFor="signup-name">Display Name</label>
              <input 
                type="text" 
                id="signup-name" 
                placeholder="John Doe" 
                value={formData.name}
                onChange={handleInputChange}
                required 
                minLength={4}
              />
            </div>
          )}

          <div className="form-group slim-form-group">
            <label htmlFor={`${activeTab}-email`}>
              {activeTab === 'admin' ? 'Admin ID (Email)' : 'Email Address'}
            </label>
            <input 
              type="email" 
              id={`${activeTab}-email`} 
              placeholder="Enter your email address" 
              value={formData.email}
              onChange={handleInputChange}
              required 
            />
          </div>

          <div className="form-group slim-form-group">
            <label htmlFor={`${activeTab}-password`}>
              {activeTab === 'admin' ? 'Admin Password' : 'Password'}
            </label>
            <div className="password-container">
              <input 
                type={showPassword ? 'text' : 'password'} 
                id={`${activeTab}-password`} 
                placeholder="Enter your password" 
                value={formData.password}
                onChange={handleInputChange}
                required 
                minLength={activeTab === 'signup' ? 6 : undefined}
              />
              <i 
                className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle`} 
                onClick={togglePassword}
              ></i>
            </div>
          </div>

          {error && <div id="login-error" style={{ display: 'block' }}>{error}</div>}

          <button 
            type="submit" 
            className={`btn-modern auth-submit-btn`}
            disabled={isLoading}
          >
            {isLoading ? (
              <><i className="fa-solid fa-spinner fa-spin"></i> Processing...</>
            ) : (
              activeTab === 'signup' ? 'Create Account' : (activeTab === 'admin' ? 'Enter Dashboard' : 'Login')
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
