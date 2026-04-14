import React from 'react';

const SkeletonCard = () => {
  return (
    <div className="card post-card" style={{ opacity: 0.7 }}>
        <div className="post-votes" style={{ padding: '1rem', background: 'transparent' }}>
            <div className="skeleton" style={{ width: '20px', height: '20px', marginBottom: '1rem' }}></div>
            <div className="skeleton" style={{ width: '15px', height: '15px', marginBottom: '1rem' }}></div>
            <div className="skeleton" style={{ width: '20px', height: '20px' }}></div>
        </div>
        
        <div className="post-content-area" style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div className="skeleton skeleton-avatar"></div>
                <div className="skeleton" style={{ width: '120px', height: '14px', marginTop: '10px' }}></div>
            </div>
            
            <div className="skeleton skeleton-title"></div>
            
            <div className="skeleton skeleton-text"></div>
            <div className="skeleton skeleton-text" style={{ width: '90%' }}></div>
            <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
            
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                <div className="skeleton" style={{ width: '80px', height: '24px', borderRadius: '4px' }}></div>
                <div className="skeleton" style={{ width: '80px', height: '24px', borderRadius: '4px' }}></div>
            </div>
        </div>
    </div>
  );
};

export default SkeletonCard;
