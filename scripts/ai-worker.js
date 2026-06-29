console.log('[AI Worker] Background job started. Checking for pending bookmarks every 5 seconds...');

setInterval(() => {
  fetch('http://localhost:3999/api/bookmarks/ai-job')
    .then(res => res.json())
    .then(data => {
      if (data.processedUrl) {
        console.log('[AI Worker] ✅ Successfully processed:', data.processedUrl);
      }
    })
    .catch(err => {
      // API might be down or not started yet, ignore silently
    });
}, 5000);
