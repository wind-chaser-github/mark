function showToast(message, type) {
  let toast = document.getElementById('ai-bookmark-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ai-bookmark-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 12px 20px;
      border-radius: 8px;
      background: #18181b;
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      z-index: 2147483647;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      opacity: 0;
      transform: translateY(20px);
      pointer-events: none;
    `;
    document.body.appendChild(toast);
  }

  if (type === 'error') toast.style.background = '#ef4444';
  else if (type === 'success') toast.style.background = '#10b981';
  else toast.style.background = '#18181b';

  toast.textContent = message;
  
  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);

  // Animate out after 3s if not loading
  if (type !== 'loading') {
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "show_toast") {
    showToast(request.message, request.type);
    sendResponse({ success: true });
    return;
  }

  if (request.action === "extract_metadata") {
    // Extract meta description
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    
    // Extract favicon
    let favicon = '';
    const iconNode = document.querySelector('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
    if (iconNode) {
      favicon = iconNode.getAttribute('href') || '';
      // Make it absolute if it's relative
      if (favicon && !favicon.startsWith('http') && !favicon.startsWith('//') && !favicon.startsWith('data:')) {
        try {
          favicon = new URL(favicon, window.location.href).href;
        } catch (e) {
          // Ignore URL parsing errors
        }
      }
    } else {
      favicon = new URL('/favicon.ico', window.location.origin).href;
    }
    
    // Extract some main text context (first 500 chars)
    const article = document.querySelector('article') || document.querySelector('main');
    const mainText = (article ? article.innerText : document.body.innerText)
                      .replace(/\s+/g, ' ').substring(0, 500);

    sendResponse({
      metaDescription,
      favicon,
      mainText
    });
  }
});
