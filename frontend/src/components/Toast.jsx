import React from 'react';

const Toast = ({ message, type, isFading }) => {
  const getIcon = () => {
    switch (type) {
      case 'success': return <i className="fa-solid fa-circle-check"></i>;
      case 'error': return <i className="fa-solid fa-circle-exclamation"></i>;
      case 'info': return <i className="fa-solid fa-circle-info"></i>;
      default: return <i className="fa-solid fa-bell"></i>;
    }
  };

  return (
    <div className={`toast ${type} ${isFading ? 'fade-out' : ''}`}>
      <span className="toast-icon">{getIcon()}</span>
      <span className="toast-message">{message}</span>
    </div>
  );
};

export default Toast;
