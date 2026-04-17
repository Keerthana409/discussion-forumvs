import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const Navbar = ({ theme, toggleTheme, currentUser, openTimeModal }) => {
  const [notifs, setNotifs] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const { showToast } = useToast();

  const fetchNotifs = async () => {
    try {
      const data = await api.get('/notifications');
      setNotifs(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (currentUser) {
      const init = async () => {
        await fetchNotifs();
      };
      init();
      const interval = setInterval(fetchNotifs, 20000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target) && !event.target.closest('#notif-toggle')) {
        setShowNotifPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotifToggle = async () => {
    const isOpening = !showNotifPanel;
    setShowNotifPanel(isOpening);

    if (isOpening) {
      const unreadCount = notifs.filter(n => !n.isRead).length;
      if (unreadCount > 0) {
        try {
          await api.put('/notifications/read');
          fetchNotifs();
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  const handleAdminAction = async (postId, action, notificationId) => {
    try {
      if (action === 'remove') {
        // Permanent delete as requested
        await api.delete(`/admin/post/${postId}`);
        showToast(`Post has been permanently deleted.`, 'success');
      } else {
        await api.patch(`/admin/post/${postId}`, { action });
        showToast(`Post has been successfully marked as ${action}.`, 'success');
      }

      // Delete the notification after successful action
      if (notificationId) {
        await api.delete(`/notifications/${notificationId}`);
      }

      setShowNotifPanel(false);
      fetchNotifs();
      // Notice: Removed refreshPosts() to prevent resetting to Page 1.
    } catch (err) {
      showToast("Failed action: " + err.message, 'error');
    }
  };

  const handleNotifClick = async (notifId) => {
    try {
      await api.delete(`/notifications/${notifId}`);
      fetchNotifs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear all notifications?")) return;
    try {
        await api.delete('/notifications');
        showToast("All notifications cleared", "success");
        fetchNotifs();
    } catch (err) {
        showToast("Failed to clear notifications", "error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    navigate('/');
  };

  const unreadCount = notifs.filter(n => !n.isRead).length;

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <i className="fa-solid fa-comments" style={{ fontSize: '1.8rem' }}></i> <span>Discussion Forum</span>
      </div>
      <div className="nav-user">
        <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Dark Mode">
          <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>

        <div className="time-tracking" onClick={openTimeModal} style={{ position: 'relative', cursor: 'pointer', marginLeft: '0.5rem' }} title="Time Tracking">
          <i className="fa-solid fa-clock" style={{ fontSize: '1.2rem' }}></i>
        </div>

        <div className="notifications" style={{ position: 'relative', cursor: 'pointer', marginLeft: '0.5rem' }} id="notif-toggle" onClick={handleNotifToggle}>
          <i className="fa-solid fa-bell" style={{ fontSize: '1.2rem' }}></i>
          {unreadCount > 0 && (
            <span className="badge badge-danger" style={{ position: 'absolute', top: '-8px', right: '-8px' }}>
              {unreadCount}
            </span>
          )}

          {showNotifPanel && (
            <div ref={panelRef} className="notifications-panel" onClick={e => e.stopPropagation()}>
              <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', position: 'sticky', top: '0', zIndex: 10 }}>
                <span style={{ fontWeight: 600 }}>Notifications</span>
                {notifs.length > 0 && (
                  <button onClick={handleClearAll} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                    Clear All
                  </button>
                )}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '300px', overflowY: 'auto' }}>
                {notifs.length === 0 ? (
                  <li style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>No notifications yet.</li>
                ) : (
                  notifs.map((n, index) => (
                    <li
                      key={n._id || `notif-${index}`}
                      className={`notif-item ${!n.isRead ? 'unread' : ''}`}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div onClick={() => handleNotifClick(n._id)} style={{ flex: 1 }}>
                          <div><strong>{n.sender}</strong> {n.context}</div>
                          <div className="notif-meta">{new Date(n.timestamp).toLocaleString()}</div>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleNotifClick(n._id); }} 
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 5px', fontSize: '0.9rem' }}
                            title="Clear"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                      {(n.type === 'admin_spam_alert' || n.type === 'admin_report_alert') && currentUser?.role === 'admin' && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-sm btn-success" onClick={(e) => { e.stopPropagation(); handleAdminAction(n.postId, 'safe', n._id); }} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                            <i className="fa-solid fa-check"></i> {n.type === 'admin_spam_alert' ? 'Not Spam' : 'Approve'}
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); handleAdminAction(n.postId, 'remove', n._id); }} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                            <i className="fa-solid fa-trash-can"></i> Delete Post
                          </button>
                        </div>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>

        {currentUser && (
          <span style={{ fontWeight: 500, marginLeft: '0.5rem' }}>
            {currentUser.username} {currentUser.role === 'admin' && '(Admin)'}
          </span>
        )}
        <button onClick={handleLogout} className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }}>Log Out</button>
      </div>
    </nav>
  );
};

export default Navbar;
