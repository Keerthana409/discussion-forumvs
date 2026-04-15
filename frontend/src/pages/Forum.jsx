import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Navbar from '../components/Navbar';
import CreatePost from '../components/CreatePost';
import PostCard from '../components/PostCard';
import SkeletonCard from '../components/SkeletonCard';
import TimeTrackingModal from '../components/TimeTrackingModal';
import api from '../services/api';

const Forum = ({ theme, toggleTheme }) => {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [filter, setFilter] = useState('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState(null);
  const [isTimeModalOpen, setTimeModalOpen] = useState(false);
  const [usageWarning, setUsageWarning] = useState(false);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPosts, setTotalPosts] = useState(0);
  const observer = useRef();

  const currentUser = JSON.parse(localStorage.getItem('nexus_user') || 'null');

  const fetchPosts = useCallback(async (pageNum = 1, isInitial = false) => {
    if (isInitial) {
        setIsLoading(true);
    } else {
        setIsFetchingMore(true);
    }

    try {
      let url = `/posts?page=${pageNum}&limit=10`;
      if (filter === 'mine' && currentUser) {
          url = `/posts/user/${currentUser.username}?page=${pageNum}&limit=10`;
      }
      const response = await api.get(url);
      
      // Robust Handling: Check if response is the new object format or the old array format
      let newPosts = [];
      let moreAvailable = false;
      
      if (Array.isArray(response)) {
          newPosts = response;
          moreAvailable = false; // Old backend doesn't support pagination
      } else if (response && response.posts) {
          newPosts = response.posts;
          moreAvailable = response.hasMore;
          if (response.total !== undefined) setTotalPosts(response.total);
      }
      
      if (isInitial) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
      
      setHasMore(moreAvailable);
      setPage(pageNum);
      
      // Removed manual scroll to top to maintain scroll position during infinite load
    } catch (err) {
      console.error(err);
    } finally {
      if (isInitial) {
          setIsLoading(false);
      } else {
          setIsFetchingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchPosts(1, true);
    
    // Usage tracker logic
    let sessionMinutes = parseInt(localStorage.getItem('df_sessionMinutes')) || 0;
    const usageInterval = setInterval(async () => {
      sessionMinutes++;
      localStorage.setItem('df_sessionMinutes', sessionMinutes);
      if (sessionMinutes > 0 && sessionMinutes % 15 === 0) setUsageWarning(true);
      try {
        await api.post('/usage');
      } catch (e) {
        console.error('Usage sync failed', e);
      }
    }, 60000);

    return () => clearInterval(usageInterval);
  }, [fetchPosts, filter]); // Added filter as dependency to re-fetch when it changes

  const lastPostElementRef = useCallback(node => {
    if (isLoading || isFetchingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchPosts(page + 1, false);
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, isFetchingMore, hasMore, page, fetchPosts]);

  const resetAndFetch = () => {
      setPage(1);
      setPosts([]);
      fetchPosts(1, true);
  };

  const filteredPosts = useMemo(() => {
    let filtered = posts.filter(p => p.status !== 'removed' && p.status !== 'hidden');

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(query) || 
        p.content.toLowerCase().includes(query) || 
        (p.tags && p.tags.join(' ').toLowerCase().includes(query))
      );
    }

    if (tagFilter) {
      filtered = filtered.filter(p => p.tags && p.tags.map(t => t.toLowerCase()).includes(tagFilter.toLowerCase()));
    }

    if (filter === 'top') {
      filtered.sort((a,b) => (b.likes - (b.dislikes || 0)) - (a.likes - (a.dislikes || 0)));
    } else if (filter === 'flagged') {
      filtered = filtered.filter(p => ['under review', 'duplicate', 'similar', 'spam'].includes(p.status));
      filtered.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else if (filter === 'safe') {
      filtered = filtered.filter(p => p.status === 'safe');
      filtered.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else if (filter === 'mine') {
      // Backend already filters by user if we fetch specifically, 
      // but if we are filtering locally (unlikely with pagination), we handle it:
      filtered = filtered.filter(p => p.author === currentUser?.username);
      filtered.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else {
      filtered.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    const pinned = filtered.filter(p => p.isPinned);
    const unpinned = filtered.filter(p => !p.isPinned);
    return [...pinned, ...unpinned];
  }, [posts, filter, searchQuery, tagFilter]);

  return (
    <div className="app-body">
      <Navbar 
        theme={theme} 
        toggleTheme={toggleTheme} 
        currentUser={currentUser} 
        openTimeModal={() => setTimeModalOpen(true)}
        refreshPosts={resetAndFetch}
      />

      <div className="app-container">
        <main className="main-content" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
          
          <div className="card filter-container" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.5rem 1rem', marginBottom: '1rem' }}>
            <div className="filter-buttons" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className={`filter-btn ${filter === 'latest' ? 'active' : ''}`} onClick={() => setFilter('latest')}>Latest Posts</button>
              <button className={`filter-btn ${filter === 'top' ? 'active' : ''}`} onClick={() => setFilter('top')}>Top Discussions</button>
              {currentUser && (
                <button className={`filter-btn ${filter === 'mine' ? 'active' : ''}`} onClick={() => setFilter('mine')}>Your Posts</button>
              )}
              {currentUser?.role === 'admin' && (
                <>
                  <button className={`filter-btn ${filter === 'flagged' ? 'active' : ''}`} onClick={() => setFilter('flagged')}>Flagged</button>
                  <button className={`filter-btn ${filter === 'safe' ? 'active' : ''}`} onClick={() => setFilter('safe')}>Safe</button>
                </>
              )}
            </div>
            <div style={{ flex: 1 }}></div>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '999px', padding: '0.3rem 0.8rem', background: 'var(--bg-card)' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-muted)' }}></i>
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'transparent', marginLeft: '0.5rem', color: 'var(--text-dark)', width: '200px' }}
              />
            </div>
          </div>

          {(searchQuery || tagFilter) && (
            <div className="search-summary active" style={{ padding: '0.8rem', background: 'rgba(255, 69, 0, 0.05)', border: '1px solid rgba(255, 69, 0, 0.2)', borderRadius: 'var(--radius)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'slideUpFade 0.4s ease' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-dark)' }}>
                    <i className="fa-solid fa-circle-info" style={{ color: 'var(--primary-color)', marginRight: '8px' }}></i>
                    Found <strong>{filteredPosts.length}</strong> posts {searchQuery && <span>matching "<strong>{searchQuery}</strong>"</span>} {tagFilter && <span>with tag #<strong>{tagFilter}</strong></span>}
                </span>
                <button onClick={() => { setSearchQuery(''); setTagFilter(null); }} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Clear All</button>
            </div>
          )}

          <CreatePost refreshPosts={resetAndFetch} />

          <div id="posts-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {isLoading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
            ) : filteredPosts.length > 0 ? (
                <>
                    {filteredPosts.map((post, index) => {
                            return (
                                <div key={post._id} ref={filteredPosts.length === index + 1 ? lastPostElementRef : null}>
                                    <PostCard 
                                        post={post} 
                                        currentUser={currentUser} 
                                        refreshPosts={resetAndFetch}
                                        setTagFilter={setTagFilter}
                                        searchQuery={searchQuery}
                                    />
                                </div>
                            );
                    })}

                    {isFetchingMore && (
                        <div style={{ padding: '1rem', textAlign: 'center' }}>
                            <SkeletonCard />
                        </div>
                    )}
                    {!hasMore && filteredPosts.length > 5 && (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            <i className="fa-solid fa-check-circle"></i> You've reached the end of the forum.
                        </div>
                    )}
                </>
            ) : (
                <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No posts found.
                </div>
            )}
          </div>
        </main>
      </div>

      <TimeTrackingModal 
        isOpen={isTimeModalOpen} 
        onClose={() => setTimeModalOpen(false)} 
        theme={theme}
      />

      {usageWarning && (() => {
        const smins = parseInt(localStorage.getItem('df_sessionMinutes')) || 0;
        const hh = Math.floor(smins / 60).toString().padStart(2, '0');
        const mm = (smins % 60).toString().padStart(2, '0');
        return (
          <div className="usage-warning-overlay">
              <div className="usage-warning-popup" style={{ border: 'none', boxShadow: 'var(--shadow-md)', padding: '2.5rem' }}>
                  <div style={{ width: '60px', height: '60px', background: 'rgba(255, 211, 0, 0.1)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 1.5rem' }}>
                      <i className="fa-solid fa-clock" style={{ fontSize: '2rem', color: 'var(--warning)' }}></i>
                  </div>
                  <h2 style={{ color: 'var(--text-dark)', marginBottom: '1rem', fontSize: '1.5rem' }}>Take a Break?</h2>
                  <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-dark)' }}>
                      You've been active for <strong>{parseInt(hh)}h:{mm}min</strong> today.
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Small breaks help keep your mind fresh and your attention sharp. Refresh yourself!</p>
                  <button className="btn btn-primary" style={{ marginTop: '2rem', width: '100%' }} onClick={() => setUsageWarning(false)}>I Understand</button>
              </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Forum;
