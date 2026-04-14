import React, { useState, useRef } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
const CreatePost = ({ refreshPosts }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [formData, setFormData] = useState({ title: '', tags: '', content: '' });
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const handleExpand = () => setIsExpanded(true);

  const handleCancel = () => {
    setIsExpanded(false);
    setFormData({ title: '', tags: '', content: '' });
    clearImage();
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      clearImage();
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    try {
      await api.post('/posts', {
        title: formData.title,
        content: formData.content,
        tags: tagsArray,
        image: imagePreview
      });
      showToast("Post published successfully!", "success");
      refreshPosts();
      handleCancel();
    } catch (err) {
      showToast("Failed to create post: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isExpanded) {
    return (
      <div className="card">
        <input 
          type="text" 
          placeholder="Create a new post..." 
          className="form-group" 
          style={{ margin: 0, width: '100%', padding: '0.8rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', cursor: 'pointer', background: 'var(--bg-light)', color: 'var(--text-dark)' }} 
          readOnly
          onClick={handleExpand}
        />
      </div>
    );
  }

  return (
    <div className="card" id="create-post-card">
      <h3 style={{ marginBottom: '1rem' }}>Create a Post</h3>
      <form onSubmit={handleSubmit} id="create-post-form">
        <div className="form-group">
          <input 
            type="text" 
            placeholder="Title" 
            required 
            style={{ fontWeight: 600, fontSize: '1.1rem' }}
            value={formData.title}
            onChange={e => setFormData({...formData, title: e.target.value})}
          />
        </div>
        <div className="form-group">
          <input 
            type="text" 
            placeholder="Tags (comma separated) e.g., Javascript, Help" 
            required
            value={formData.tags}
            onChange={e => setFormData({...formData, tags: e.target.value})}
          />
        </div>
        <div className="form-group">
          <textarea 
            placeholder="Share your knowledge..." 
            rows="5" 
            required
            value={formData.content}
            onChange={e => setFormData({...formData, content: e.target.value})}
          ></textarea>
        </div>
        <div className="form-group" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '0.9rem' }}>Attach an Image (Optional):</label>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef}
              onChange={handleImageChange}
              style={{ padding: '0.5rem', background: 'var(--bg-light)', border: '1px dashed var(--border-color)', cursor: 'pointer', display: 'block' }} 
            />
          </div>
          {imagePreview && (
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <img src={imagePreview} alt="Preview" style={{ maxHeight: '80px', maxWidth: '150px', objectFit: 'cover', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }} />
              <button 
                type="button" 
                onClick={clearImage}
                className="btn btn-sm" 
                style={{ background: 'var(--bg-card)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '50%', width: '24px', height: '24px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '0.5rem', cursor: 'pointer' }}
                title="Clear Image"
              >
                &times;
              </button>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={isSubmitting}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Publishing...' : 'Publish Post'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePost;
