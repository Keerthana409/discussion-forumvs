import React, { useState } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

// Mock summarizer removed in favor of real AI backend logic

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

const renderComments = (comments, depth, postId, postAuthor, currentUser, refreshPosts, showToast) => {
  if (!comments || comments.length === 0) return null;
  return comments.map(c => <CommentItem key={c.id} c={c} depth={depth} postId={postId} postAuthor={postAuthor} currentUser={currentUser} refreshPosts={refreshPosts} showToast={showToast} />);
};

const CommentItem = ({ c, depth, postId, postAuthor, currentUser, refreshPosts, showToast }) => {
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
      
      {(currentUser?.role === 'admin' || currentUser?.username === postAuthor || currentUser?.username === c.author) && (
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

      {renderComments(c.replies, depth + 1, postId, postAuthor, currentUser, refreshPosts, showToast)}
    </div>
  );
};

const PostCard = ({ post, currentUser, refreshPosts, setTagFilter, searchQuery }) => {
  const [localPost, setLocalPost] = useState(post);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [summaryMode, setSummaryMode] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeakingPost, setIsSpeakingPost] = useState(false);
  const [actionProcessing, setActionProcessing] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmUserDelete, setConfirmUserDelete] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const { showToast } = useToast();

  React.useEffect(() => {
    setLocalPost(post);
  }, [post]);

  const fetchAiSummary = async (mode) => {
    if (!mode) return;
    setIsSummarizing(true);
    setAiSummary('');
    try {
        // Use a timestamp to prevent browser cache from serving stale AI summaries
        const res = await api.post(`/ai/summarize?t=${Date.now()}`, { content: localPost.content, level: mode.toUpperCase() });
        setAiSummary(res.summary);
    } catch (err) {
        setAiSummary(`Failed to generate summary: ${err.message}`);
    } finally {
        setIsSummarizing(false);
    }
  };

  const handleSummaryToggle = (mode) => {
      // Stop speaking if mode changes
      if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          setIsSpeaking(false);
      }

      if (summaryMode === mode) {
          setSummaryMode(null);
          setAiSummary('');
      } else {
          setSummaryMode(mode);
          fetchAiSummary(mode);
      }
  };

  const handleListen = () => {
    if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
    }

    if (!aiSummary) return;

    // Fix AI pronunciation: replace bounded "AI" with "A I"
    const parsedSummary = aiSummary.replace(/\bAI\b/gi, 'A I');
    const utterance = new SpeechSynthesisUtterance(parsedSummary);
    
    // Attempt to find an Indian English voice (en-IN)
    const voices = window.speechSynthesis.getVoices();
    const indianVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en_IN'));
    if (indianVoice) {
        utterance.voice = indianVoice;
        utterance.lang = 'en-IN';
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleListenPost = () => {
    if (isSpeakingPost) {
        window.speechSynthesis.cancel();
        setIsSpeakingPost(false);
        return;
    }

    if (!localPost.title && !localPost.content) return;

    const postText = `${localPost.title}. ${localPost.content}`;
    // Fix AI pronunciation
    const parsedText = postText.replace(/\bAI\b/gi, 'A I');
    
    const utterance = new SpeechSynthesisUtterance(parsedText);
    
    const voices = window.speechSynthesis.getVoices();
    const indianVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en_IN'));
    if (indianVoice) {
        utterance.voice = indianVoice;
        utterance.lang = 'en-IN';
    }

    utterance.onend = () => setIsSpeakingPost(false);
    utterance.onerror = () => setIsSpeakingPost(false);
    
    setIsSpeakingPost(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleVote = async (type) => {
    if (actionProcessing) return;
    setActionProcessing('vote');
    try {
      const updatedPost = await api.post(`/posts/${localPost._id}/vote`, { type });
      setLocalPost(updatedPost);
    } catch(e) { showToast(e.message || "Failed to vote", "error"); }
    finally { setActionProcessing(null); }
  };

  const handleReact = async (type) => {
    if (actionProcessing) return;
    setActionProcessing('react');
    try {
      const updatedPost = await api.post(`/posts/${localPost._id}/react`, { type });
      setLocalPost(updatedPost);
    } catch(e) { showToast(e.message || "Failed to react", "error"); }
    finally { setActionProcessing(null); }
  };

  const handleReport = async () => {
    const reason = prompt("Please provide a reason for reporting:");
    if(!reason) return;
    setActionProcessing('report');
    try {
        console.log(`Reporting post ${localPost._id} for reason: ${reason}`);
        const updatedPost = await api.post(`/posts/${localPost._id}/report`, { reason, reporter: currentUser?.username || 'anonymous' });
        showToast("Post added to the Report Queue and placed Under Review.", "success"); 
        setLocalPost(updatedPost); // Update local state immediately
        if (refreshPosts) refreshPosts(); 
    } catch(err) { 
        console.error("Report failed:", err);
        showToast(err.message || "Report failed", "error"); 
    }
    finally { setActionProcessing(null); }
  };

  const handleAdminStatus = async (action) => {
    if (actionProcessing) return;
    
    // Inline confirmation logic for permanent removals
    if (action === 'remove' && !confirmRemove) {
        setConfirmRemove(true);
        return;
    }

    setActionProcessing('admin');
    try {
        if (action === 'remove') {
            await api.delete(`/admin/post/${localPost._id}`);
            showToast("Post permanently deleted", "success");
            setLocalPost({ ...localPost, isDeletedLocally: true });
        } else {
            const updated = await api.patch(`/admin/post/${localPost._id}`, { action });
            setLocalPost(updated);
            showToast(`Status updated to ${action}`, "success");
        }
    } catch (err) {
        showToast(err.message || "Admin action failed", "error");
    }
    finally { 
        setActionProcessing(null); 
        setConfirmRemove(false);
    }
  };

  const getUserDeleteAction = async () => {
    if (actionProcessing) return;
    
    if (!confirmUserDelete) {
        setConfirmUserDelete(true);
        // Reset after 3 seconds if not clicked
        setTimeout(() => setConfirmUserDelete(false), 3000);
        return;
    }

    setActionProcessing('delete');
    try {
        console.log(`Attempting to delete post: ${localPost._id}`);
        const res = await api.delete(`/posts/${localPost._id}?t=${Date.now()}`);
        showToast("Post deleted successfully", "success");
        setLocalPost({ ...localPost, isDeletedLocally: true });
        if (refreshPosts) refreshPosts();
    } catch (err) {
        console.error("Delete failed:", err);
        showToast(err.message || "Failed to delete post", "error");
    } finally {
        setActionProcessing(null);
        setConfirmUserDelete(false);
    }
  };

  const handleEditClick = () => {
    setEditTitle(localPost.title);
    setEditContent(localPost.content);
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleEditSubmit = async (e) => {
    e.stopPropagation();
    if (actionProcessing) return;
    setActionProcessing('edit');
    try {
      const updatedPost = await api.put(`/posts/${localPost._id}`, { title: editTitle, content: editContent });
      setLocalPost(updatedPost);
      setIsEditing(false);
      showToast("Post updated successfully", "success");
    } catch(err) {
      showToast(err.message || "Failed to edit post", "error");
    } finally {
      setActionProcessing(null);
    }
  };

  const handlePostClick = async () => {
    try {
        await api.delete(`/notifications/post/${localPost._id}`);
    } catch (err) {
        console.error("Failed to clear post notifications", err);
    }
  };

  const handleCommentSubmit = async () => {
    if(!newComment.trim() || actionProcessing === 'comment') return;
    setActionProcessing('comment');
    try {
      const updatedPost = await api.post(`/posts/${localPost._id}/comment`, { content: newComment });
      setNewComment('');
      showToast("Comment posted!", "success");
      setLocalPost(updatedPost);
    } catch (err) { showToast(err.message || "Comment failed", "error"); }
    finally { setActionProcessing(null); }
  };

  let statusLabel = null;
  let borderLeftStyle = '';
  const isAi = localPost.isAiFlagged;

  const handleAiBadgeClick = (e) => {
    e.stopPropagation();
    if (localPost.aiReason) {
        showToast(`✨ AI Notice: ${localPost.aiReason}`, "info");
    } else if (localPost.status === 'under review' && localPost.reportReason) {
        showToast(`🚩 Report Reason: ${localPost.reportReason}`, "info");
    }
  };

  if (localPost.status === 'spam') {
    statusLabel = (
        <div className="badge-reason-wrapper">
          <span className="badge badge-danger" style={{ cursor: 'pointer' }} onClick={handleAiBadgeClick}>
            {isAi ? '🤖 AI Spam' : '⚠️ Spam'}
          </span>
          <span className="badge-reason-tooltip">{localPost.aiReason || "Flagged for spam patterns."}</span>
        </div>
    );
    borderLeftStyle = "4px solid var(--danger)";
  } else if (localPost.status === 'toxic') {
    statusLabel = (
        <div className="badge-reason-wrapper">
          <span className="badge badge-danger" style={{ cursor: 'pointer' }} onClick={handleAiBadgeClick}>
            {isAi ? '🤖 AI Toxic' : '☣️ Toxic'}
          </span>
          <span className="badge-reason-tooltip">{localPost.aiReason || "Flagged for harmful language."}</span>
        </div>
    );
    borderLeftStyle = "4px solid var(--danger)";
  } else if (localPost.status === 'duplicate') {
    statusLabel = (
        <div className="badge-reason-wrapper">
            <span className="badge badge-warning" style={{ cursor: 'pointer' }} onClick={handleAiBadgeClick}>
                {isAi ? '🤖 AI Duplicate' : '📋 Duplicate'} {currentUser?.role === 'admin' && localPost.similarTo && <small style={{display:'block', fontSize:'0.6rem'}}>Ref ID: {localPost.similarTo.slice(-6)}</small>}
            </span>
            <span className="badge-reason-tooltip">{localPost.aiReason || "Matches an existing post."}</span>
        </div>
    );
  } else if (localPost.status === 'similar') {
    statusLabel = (
        <div className="badge-reason-wrapper">
            <span className="badge badge-warning" style={{ cursor: 'pointer' }} onClick={handleAiBadgeClick}>
                {isAi ? '🤖 AI Similar' : '📋 Similar'} {currentUser?.role === 'admin' && localPost.similarTo && <small style={{display:'block', fontSize:'0.6rem'}}>Ref ID: {localPost.similarTo.slice(-6)}</small>}
            </span>
            <span className="badge-reason-tooltip">{localPost.aiReason || "Similar to existing content."}</span>
        </div>
    );
  } else if (localPost.status === 'under review') {
        const reportText = localPost.reportReason ? `Reported by a user: ${localPost.reportReason}` : "Reported by a user";
        statusLabel = (
            <div className="badge-reason-wrapper">
                <span className="badge badge-warning" style={{ cursor: 'pointer' }} onClick={handleAiBadgeClick}>🚩 Under Review</span>
                <span className="badge-reason-tooltip">{reportText}</span>
            </div>
        );
        borderLeftStyle = "4px solid var(--warning)";
  } else if (localPost.status === 'removed') {
        statusLabel = <span className="badge badge-danger">❌ Removed</span>;
  }

  const dislikeCount = localPost.dislikes || 0;
  
  if (localPost.isDeletedLocally) return null;

  return (
    <div className={`card post-card ${localPost.isPinned ? 'pinned-post' : ''} post-card-animate`} style={borderLeftStyle ? { borderLeft: borderLeftStyle } : {}} onClick={handlePostClick}>
      <div className="post-votes" onClick={e => e.stopPropagation()}>
          <button className="vote-btn upvote" onClick={() => handleVote('up')}><i className="fa-solid fa-arrow-up"></i></button>
          <span>{localPost.likes - dislikeCount}</span>
          <button className="vote-btn down downvote" onClick={() => handleVote('down')}><i className="fa-solid fa-arrow-down"></i></button>
      </div>

      <div className="post-content-area">
          <div className="post-meta">
              <span>Posted by <strong>u/{localPost.author}</strong></span>
              <span>•</span>
              <span>{new Date(localPost.timestamp).toLocaleString()}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {statusLabel}
                  {currentUser && (localPost.author === currentUser.username || currentUser.role === 'admin') && (
                      <div style={{ position: 'relative' }}>
                          <button 
                              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}
                          >
                              <i className="fa-solid fa-ellipsis-vertical"></i>
                          </button>
                          {showMenu && (
                              <div className="post-options-menu" style={{
                                  position: 'absolute', right: 0, top: '100%',
                                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                  borderRadius: '4px', boxShadow: 'var(--shadow)', zIndex: 10,
                                  minWidth: '120px', display: 'flex', flexDirection: 'column', overflow: 'hidden'
                              }}>
                                  <button 
                                      onClick={(e) => { e.stopPropagation(); handleEditClick(); }}
                                      style={{ padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-dark)' }}
                                  >
                                      <i className="fa-solid fa-pen" style={{ marginRight: '8px' }}></i> Edit Post
                                  </button>

                                  {currentUser?.role === 'admin' ? (
                                      <>
                                          {/* Approval Action */}
                                          {(['under review', 'duplicate', 'similar', 'spam', 'toxic'].includes(localPost.status)) && (
                                              <button 
                                                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleAdminStatus('safe'); }}
                                                  style={{ padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--success)', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)' }}
                                              >
                                                  <i className="fa-solid fa-check" style={{ marginRight: '8px' }}></i> Approve
                                              </button>
                                          )}

                                          {/* AI Flag Removal */}
                                          {localPost.isAiFlagged && (
                                              <button 
                                                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleAdminStatus('unflag'); }}
                                                  style={{ padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--primary-color)', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)' }}
                                              >
                                                  <i className="fa-solid fa-robot" style={{ marginRight: '8px', opacity: 0.7 }}></i> Remove AI Flag
                                              </button>
                                          )}

                                          {/* Status Overrides */}
                                          {localPost.status !== 'spam' && (
                                              <button 
                                                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleAdminStatus('spam'); }}
                                                  style={{ padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--warning)', borderBottom: '1px solid var(--border-color)' }}
                                              >
                                                  <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px' }}></i> Mark Spam
                                              </button>
                                          )}
                                          
                                          {localPost.status !== 'toxic' && (
                                              <button 
                                                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleAdminStatus('toxic'); }}
                                                  style={{ padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--danger)', borderBottom: '1px solid var(--border-color)' }}
                                              >
                                                  <i className="fa-solid fa-biohazard" style={{ marginRight: '8px' }}></i> Mark Toxic
                                              </button>
                                          )}

                                          {localPost.status !== 'duplicate' && (
                                              <button 
                                                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleAdminStatus('duplicate'); }}
                                                  style={{ padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-dark)', borderBottom: '1px solid var(--border-color)' }}
                                              >
                                                  <i className="fa-solid fa-copy" style={{ marginRight: '8px' }}></i> Mark Duplicate
                                              </button>
                                          )}

                                          {/* Critical Actions */}
                                          <button 
                                              onClick={(e) => { e.stopPropagation(); handleAdminStatus('remove'); }}
                                              style={{ padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--danger)', fontWeight: 'bold' }}
                                          >
                                              <i className={`fa-solid ${confirmRemove ? 'fa-triangle-exclamation' : 'fa-trash-can'}`} style={{ marginRight: '8px' }}></i> 
                                              {confirmRemove ? 'Confirm Delete?' : 'Delete Post'}
                                          </button>
                                      </>
                                  ) : (
                                      <button 
                                          onClick={(e) => { e.stopPropagation(); getUserDeleteAction(); }}
                                          style={{ padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--danger)' }}
                                      >
                                          <i className={`fa-solid ${confirmUserDelete ? 'fa-triangle-exclamation' : 'fa-trash'}`} style={{ marginRight: '8px' }}></i> 
                                          {confirmUserDelete ? 'Confirm?' : 'Delete'}
                                      </button>
                                  )}
                              </div>
                          )}
                      </div>
                  )}
              </div>
          </div>

          {isEditing ? (
              <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '10px' }} onClick={e => e.stopPropagation()}>
                  <input 
                      type="text" 
                      value={editTitle} 
                      onChange={e => setEditTitle(e.target.value)}
                      style={{ padding: '8px', fontSize: '1.2rem', fontWeight: 'bold', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-dark)' }}
                  />
                  <textarea 
                      value={editContent} 
                      onChange={e => setEditContent(e.target.value)}
                      rows={5}
                      style={{ padding: '8px', fontFamily: 'inherit', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-dark)', resize: 'vertical' }}
                  ></textarea>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setIsEditing(false); }} style={{ background: 'var(--bg-light)', color: 'var(--text-dark)', border: '1px solid var(--border-color)' }}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={handleEditSubmit} disabled={actionProcessing === 'edit'}>
                          {actionProcessing === 'edit' ? 'Saving...' : 'Save'}
                      </button>
                  </div>
              </div>
          ) : (
              <>
                  <h3 className="post-title">
                    {localPost.isPinned && <i className="fa-solid fa-thumbtack pinned-icon"></i>}
                    {' '}
                    <HighlightedText text={localPost.title} highlight={searchQuery || ''} />
                  </h3>

                  <div className="post-tags-container">
                    {localPost.tags?.map((t, i) => (
                      <span key={i} className="post-tag badge" style={{ color: 'var(--text-dark)' }} onClick={(e) => { e.stopPropagation(); setTagFilter(t); }}>{t}</span>
                    ))}
                  </div>

                  <div className="post-body">
                    <HighlightedText text={localPost.content} highlight={searchQuery || ''} />
                  </div>
              </>
          )}

          {summaryMode && (
            <div className="post-summary" style={{ marginBottom: '1rem', padding: '0.8rem', background: 'var(--secondary-color)', borderLeft: '3px solid var(--primary-color)', borderRadius: '4px', fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--text-dark)' }}>
               <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' }}>Summary Length:</span>
                  <div className="summary-options">
                      <button className="summary-opt-btn" style={summaryMode === 'short' ? { background:'var(--primary-color)', color: '#ffffff' } : {}} onClick={() => handleSummaryToggle('short')}>Short</button>
                      <button className="summary-opt-btn" style={summaryMode === 'medium' ? { background:'var(--primary-color)', color: '#ffffff' } : {}} onClick={() => handleSummaryToggle('medium')}>Medium</button>
                      <button className="summary-opt-btn" style={summaryMode === 'detailed' ? { background:'var(--primary-color)', color: '#ffffff' } : {}} onClick={() => handleSummaryToggle('detailed')}>Detailed</button>
                  </div>
              </div>
              <div className="summary-output" style={{ position: 'relative' }}>
                <strong>✨ AI Summary ({summaryMode.charAt(0).toUpperCase() + summaryMode.slice(1)}):</strong> 
                {isSummarizing ? (
                  <span style={{ marginLeft: '10px', opacity: 0.7 }}>
                    <i className="fa-solid fa-circle-notch fa-spin"></i> Analyzing content...
                  </span>
                ) : (
                  <>
                    <span> {aiSummary}</span>
                    {aiSummary && (
                      <button 
                        onClick={handleListen} 
                        className="listen-btn" 
                        title={isSpeaking ? "Stop Listening" : "Listen to Summary"}
                        style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', marginLeft: '8px', fontSize: '1rem', verticalAlign: 'middle', transition: 'transform 0.2s' }}
                      >
                        <i className={`fa-solid ${isSpeaking ? 'fa-circle-stop pulse-animation' : 'fa-volume-high'}`}></i>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {localPost.image && <img src={localPost.image} alt="Post attachment" className="post-attached-image" loading="lazy" />}
          {localPost.video && (
              <video src={localPost.video} controls loop className="post-attached-video" style={{ width: '100%', maxHeight: '500px', borderRadius: 'var(--radius)', marginTop: '0.5rem', marginBottom: '0.5rem', backgroundColor: '#000' }}></video>
          )}

          <div className="post-actions" onClick={e => e.stopPropagation()}>
              <button 
                className="action-btn listen-post-btn" 
                onClick={handleListenPost}
                style={{ color: isSpeakingPost ? 'var(--primary-color)' : 'inherit' }}
              >
                <i className={`fa-solid ${isSpeakingPost ? 'fa-circle-stop pulse-animation' : 'fa-volume-high'}`}></i> {isSpeakingPost ? 'Stop' : 'Listen'}
              </button>
              <button className="action-btn summarize-btn" onClick={() => handleSummaryToggle(summaryMode ? null : 'short')}>
                <i className="fa-solid fa-bolt"></i> Summarize
              </button>
              <button className="action-btn comment-btn" onClick={() => setShowComments(!showComments)}>
                <i className="fa-regular fa-comment-dots"></i> {localPost.comments ? localPost.comments.length : 0} Comments
              </button>

              {currentUser?.role !== 'admin' && (
                localPost.hasReport ? (
                  <button className="action-btn" disabled style={{ opacity: 0.6, cursor: 'not-allowed', color: 'var(--danger)' }}>
                    <i className="fa-solid fa-flag"></i> Reported
                  </button>
                ) : (
                  <button className="action-btn report-btn" onClick={handleReport}>
                    <i className="fa-regular fa-flag"></i> Report
                  </button>
                )
              )}



              <div className="emoji-reactions" style={{ display: 'flex', gap: '0.4rem' }}>
                {[
                  { type: 'fire', emoji: '🔥' },
                  { type: 'laugh', emoji: '😂' },
                  { type: 'heart', emoji: '❤️' },
                  { type: 'sad', emoji: '😢' }
                ].map(({ type, emoji }) => {
                    const count = localPost.reactions?.[type] || 0;
                    const userReaction = localPost.reactionDetails?.find(r => r.username === currentUser?.username);
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
              {renderComments(localPost.comments, 1, localPost._id, localPost.author, currentUser, refreshPosts, showToast)}
            </div>
          )}
      </div>
    </div>
  );
};

export default PostCard;
