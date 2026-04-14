import React, { useState } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const summarizeText = (text, mode = 'short') => {
  if (!text) return "";
  let temp = text.replace(/\b(Mr|Mrs|Ms|Dr|Sr|Jr|Prof|vs|etc)\./gi, '$1<dot>').replace(/([A-Z])\./g, '$1<dot>');
  let rawSentences = temp.match(/[^.!?]+[.!?]+/g) || [text];
  const sentences = rawSentences.map(s => s.replace(/<dot>/g, '.').trim());
  
  if (mode === 'detailed') {
      let simpleText = sentences.slice(0, Math.min(6, Math.max(5, sentences.length))).join(' ').trim().toLowerCase();
      const simplifications = {
          'utilize': 'use', 'facilitate': 'help', 'implement': 'do',
          'subsequently': 'then', 'optimum': 'best', 'necessitate': 'need', 'commence': 'start'
      };
      for(const [complex, simple] of Object.entries(simplifications)) {
          simpleText = simpleText.replace(new RegExp(`\\b${complex}\\b`, 'g'), simple);
      }
      return `In simple words: ${simpleText}`;
  } else if (mode === 'medium') {
      return sentences.slice(0, Math.min(3, Math.max(2, sentences.length))).join(' ').trim();
  }
  return sentences.slice(0, 1).join(' ').trim();
};

const HighlightedText = ({ text, highlight }) => {
  if (!highlight.trim()) {
    return <span>{text}</span>;
  }
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) => 
        regex.test(part) ? <span key={i} className="highlight">{part}</span> : part
      )}
    </span>
  );
};

const renderComments = (comments, depth, postId, currentUser, refreshPosts, showToast) => {
  if (!comments || comments.length === 0) return null;
  return comments.map(c => <CommentItem key={c.id} c={c} depth={depth} postId={postId} currentUser={currentUser} refreshPosts={refreshPosts} showToast={showToast} />);
};

const CommentItem = ({ c, depth, postId, currentUser, refreshPosts, showToast }) => {
  const [showReplyPanel, setShowReplyPanel] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleReplySubmit = async () => {
    if(!replyText.trim()) return;
    try {
        await api.post(`/posts/${postId}/comment`, { content: replyText, targetCommentId: c.id });
        setReplyText('');
        setShowReplyPanel(false);
        showToast("Reply posted!", "success");
        refreshPosts();
    } catch(err) { showToast(err.message, "error"); }
  };

  const handleDelete = async () => {
    if(!window.confirm("Are you sure you want to delete this comment?")) return;
    try {
        await api.delete(`/posts/${postId}/comment/${c.id}`);
        showToast("Comment deleted", "success");
        refreshPosts();
    } catch(err) { showToast("Failed to delete: " + err.message, "error"); }
  };

  const depthClass = depth > 6 ? 'nested-comment-depth-6' : 'nested-comment'; 

  return (
    <div className={depthClass} style={depth === 1 ? { paddingLeft: 0, borderLeft: 'none' } : {}}>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
        <strong>{c.author}</strong> • {new Date(c.timestamp).toLocaleString()}
      </div>
      <div style={{ fontSize: '0.9rem', color: 'var(--text-dark)', marginBottom: '0.3rem' }}>{c.content}</div>
      
      {depth <= 6 && (
        <button onClick={() => setShowReplyPanel(!showReplyPanel)} className="btn btn-sm reply-btn" style={{ padding: 0, background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.8rem' }}>
          <i className="fa-solid fa-reply"></i> Reply
        </button>
      )}
      
      {currentUser?.role === 'admin' && (
        <button onClick={handleDelete} className="btn btn-sm delete-comment-btn" style={{ padding: 0, marginLeft: '0.5rem', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem' }}>
          <i className="fa-solid fa-trash"></i> Delete
        </button>
      )}
      
      {showReplyPanel && (
        <div className="reply-input-container" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
            <input type="text" className="reply-input" placeholder="Reply..." value={replyText} onChange={e => setReplyText(e.target.value)} style={{ flex: 1, padding: '0.3rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', color: 'var(--text-dark)', fontSize: '0.8rem' }} />
            <button className="btn btn-primary submit-reply-btn btn-sm" onClick={handleReplySubmit}>Post</button>
        </div>
      )}

      {renderComments(c.replies, depth + 1, postId, currentUser, refreshPosts, showToast)}
    </div>
  );
};

const PostCard = ({ post, currentUser, refreshPosts, setTagFilter, searchQuery }) => {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [summaryMode, setSummaryMode] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { showToast } = useToast();

  const handleVote = async (type) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await api.post(`/posts/${post._id}/vote`, { type });
      refreshPosts();
    } catch(e) { showToast(e.message || "Failed to vote", "error"); }
    finally { setIsProcessing(false); }
  };

  const handleReact = async (type) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await api.post(`/posts/${post._id}/react`, { type });
      refreshPosts();
    } catch(e) { showToast(e.message || "Failed to react", "error"); }
    finally { setIsProcessing(false); }
  };

  const handleReport = async () => {
    const reason = prompt("Please provide a reason for reporting:");
    if(!reason) return;
    setIsProcessing(true);
    try {
        await api.post(`/posts/${post._id}/report`, { reason, reporter: currentUser.username });
        showToast("Post added to the Report Queue and placed Under Review.", "success"); 
        refreshPosts();
    } catch(err) { showToast(err.message || "Report failed", "error"); }
    finally { setIsProcessing(false); }
  };

  const handleAdminStatus = async (action) => {
    if (isProcessing) return;
    if (action === 'remove' && !window.confirm("Are you sure you want to remove this post?")) return;
    setIsProcessing(true);
    try {
        await api.patch(`/admin/post/${post._id}`, { action });
        showToast(`Post successfully marked as ${action}`, "success");
        refreshPosts();
    } catch(err) { showToast(err.message || "Admin action failed", "error"); }
    finally { setIsProcessing(false); }
  };

  const handlePostClick = async () => {
    try {
        await api.delete(`/notifications/post/${post._id}`);
    } catch (err) {
        console.error("Failed to clear post notifications", err);
    }
  };

  const handleCommentSubmit = async () => {
    if(!newComment.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      await api.post(`/posts/${post._id}/comment`, { content: newComment });
      setNewComment('');
      showToast("Comment posted!", "success");
      refreshPosts();
    } catch (err) { showToast(err.message || "Comment failed", "error"); }
    finally { setIsProcessing(false); }
  };

  let statusLabel = null;
  let borderLeftStyle = '';
  if (post.status === 'spam') {
        const canAdminRemove = currentUser?.role === 'admin';
        statusLabel = (
          <span 
            className={`badge badge-danger ${canAdminRemove ? 'clickable-badge' : ''}`} 
            style={canAdminRemove ? { cursor: 'pointer', border: '1px solid white' } : {}}
            title={canAdminRemove ? "Click to Remove this Spam Post" : ""}
            onClick={() => canAdminRemove && handleAdminStatus('remove')}
          >
            ⚠️ Spam {canAdminRemove && <i className="fa-solid fa-trash-can" style={{marginLeft: '4px'}}></i>}
          </span>
        );
        borderLeftStyle = "4px solid var(--danger)";
  } else if (post.status === 'duplicate') {
        statusLabel = (
            <span className="badge badge-danger">
                📋 Duplicate {currentUser?.role === 'admin' && post.similarTo && <small style={{display:'block', fontSize:'0.6rem'}}>Ref ID: {post.similarTo.slice(-6)}</small>}
            </span>
        );
  } else if (post.status === 'similar') {
        statusLabel = (
            <span className="badge badge-warning">
                📋 Similar {currentUser?.role === 'admin' && post.similarTo && <small style={{display:'block', fontSize:'0.6rem'}}>Ref ID: {post.similarTo.slice(-6)}</small>}
            </span>
        );
  } else if (post.status === 'under review') {
        statusLabel = <span className="badge badge-warning">🚩 Under Review</span>;
        borderLeftStyle = "4px solid var(--warning)";
  } else if (post.status === 'removed') {
        statusLabel = <span className="badge badge-danger">❌ Removed</span>;
  }

  const dislikeCount = post.dislikes || 0;

  return (
    <div className={`card post-card ${post.isPinned ? 'pinned-post' : ''} post-card-animate`} style={borderLeftStyle ? { borderLeft: borderLeftStyle } : {}} onClick={handlePostClick}>
      <div className="post-votes">
          <button className="vote-btn upvote" onClick={() => handleVote('up')}><i className="fa-solid fa-arrow-up"></i></button>
          <span>{post.likes - dislikeCount}</span>
          <button className="vote-btn down downvote" onClick={() => handleVote('down')}><i className="fa-solid fa-arrow-down"></i></button>
      </div>

      <div className="post-content-area">
          <div className="post-meta">
              <span>Posted by <strong>u/{post.author}</strong></span>
              <span>•</span>
              <span>{new Date(post.timestamp).toLocaleString()}</span>
              <div style={{ marginLeft: 'auto' }}>{statusLabel}</div>
          </div>

          <h3 className="post-title">
            {post.isPinned && <i className="fa-solid fa-thumbtack pinned-icon"></i>}
            {' '}
            <HighlightedText text={post.title} highlight={searchQuery} />
          </h3>

          <div style={{ marginBottom: '0.5em', display: 'flex', gap: '0.3rem' }}>
            {post.tags?.map((t, i) => (
              <span key={i} className="post-tag badge" style={{ color: 'var(--text-dark)' }} onClick={() => setTagFilter(t)}>{t}</span>
            ))}
          </div>

          <div className="post-body">
            <HighlightedText text={post.content} highlight={searchQuery} />
          </div>

          {summaryMode && (
            <div className="post-summary" style={{ marginBottom: '1rem', padding: '0.8rem', background: 'var(--secondary-color)', borderLeft: '3px solid var(--primary-color)', borderRadius: '4px', fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--text-dark)' }}>
               <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' }}>Summary Length:</span>
                  <div className="summary-options">
                      <button className="summary-opt-btn" style={summaryMode === 'short' ? { background:'var(--primary-color)' } : {}} onClick={() => setSummaryMode('short')}>Short</button>
                      <button className="summary-opt-btn" style={summaryMode === 'medium' ? { background:'var(--primary-color)' } : {}} onClick={() => setSummaryMode('medium')}>Medium</button>
                      <button className="summary-opt-btn" style={summaryMode === 'detailed' ? { background:'var(--primary-color)' } : {}} onClick={() => setSummaryMode('detailed')}>Detailed</button>
                  </div>
              </div>
              <div className="summary-output">
                <strong>✨ AI Summary ({summaryMode.charAt(0).toUpperCase() + summaryMode.slice(1)}):</strong> {summarizeText(post.content, summaryMode)}
              </div>
            </div>
          )}

          {post.image && <img src={post.image} alt="Post attachment" className="post-attached-image" loading="lazy" />}

          <div className="post-actions">
              <button className="action-btn summarize-btn" onClick={() => setSummaryMode(summaryMode ? null : 'short')}>
                <i className="fa-solid fa-bolt"></i> Summarize
              </button>
              <button className="action-btn comment-btn" onClick={() => setShowComments(!showComments)}>
                <i className="fa-regular fa-comment-dots"></i> {post.comments ? post.comments.length : 0} Comments
              </button>

              {currentUser?.role !== 'admin' && (
                post.hasReport ? (
                  <button className="action-btn" disabled style={{ opacity: 0.6, cursor: 'not-allowed', color: 'var(--danger)' }}>
                    <i className="fa-solid fa-flag"></i> Reported
                  </button>
                ) : (
                  <button className="action-btn report-btn" onClick={handleReport}>
                    <i className="fa-regular fa-flag"></i> Report
                  </button>
                )
              )}

              {currentUser?.role === 'admin' && (['under review', 'duplicate', 'similar', 'spam'].includes(post.status)) && (
                <>
                  <button className="action-btn admin-approve-btn" disabled={isProcessing} onClick={() => handleAdminStatus('safe')} style={{ color: 'var(--success)', borderColor: 'var(--success)', fontWeight: 'bold' }}>
                    <i className={`fa-solid ${isProcessing ? 'fa-spinner fa-spin' : 'fa-check'}`}></i> {isProcessing ? 'Wait...' : (post.status === 'spam' ? 'Not Spam' : 'Approve')}
                  </button>
                  <button className="action-btn admin-reject-btn" disabled={isProcessing} onClick={() => handleAdminStatus(post.status === 'spam' ? 'remove' : 'spam')} style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontWeight: 'bold' }}>
                    <i className={`fa-solid ${isProcessing ? 'fa-spinner fa-spin' : post.status === 'spam' ? 'fa-trash-can' : 'fa-xmark'}`}></i> {isProcessing ? 'Wait...' : (post.status === 'spam' ? 'Remove Post' : 'Reject')}
                  </button>
                </>
              )}

              <div className="emoji-reactions" style={{ display: 'flex', gap: '0.4rem' }}>
                {[
                  { type: 'fire', emoji: '🔥' },
                  { type: 'laugh', emoji: '😂' },
                  { type: 'heart', emoji: '❤️' },
                  { type: 'sad', emoji: '😢' }
                ].map(({ type, emoji }) => {
                    const count = post.reactions?.[type] || 0;
                    const userReaction = post.reactionDetails?.find(r => r.username === currentUser?.username);
                    const isActive = userReaction?.type === type;
                    
                    return (
                        <button 
                          key={type}
                          className={`emoji-btn ${type}-react ${isActive ? 'active' : ''}`} 
                          onClick={() => handleReact(type)}
                          style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: '20px',
                              border: isActive ? '1.5px solid var(--primary-color)' : '1px solid transparent',
                              background: isActive ? 'rgba(255, 69, 0, 0.1)' : 'var(--bg-light)',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.9rem',
                              color: 'var(--text-dark)'
                          }}
                        >
                          <span style={{ fontSize: isActive ? '1.1rem' : '1rem' }}>{emoji}</span> 
                          <span style={{ fontWeight: isActive ? 700 : 400 }}>{count}</span>
                        </button>
                    );
                })}
              </div>
          </div>

          {showComments && (
            <div className="comments-section" style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input 
                    type="text" 
                    className="comment-input" 
                    placeholder="What are your thoughts?" 
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', background: 'var(--bg-light)', color: 'var(--text-dark)' }} 
                  />
                  <button className="btn btn-primary submit-comment-btn" onClick={handleCommentSubmit}>Reply</button>
              </div>
              {renderComments(post.comments, 1, post._id, currentUser, refreshPosts, showToast)}
            </div>
          )}
      </div>
    </div>
  );
};

export default PostCard;
