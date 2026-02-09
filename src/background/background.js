chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'FETCH_DAILY_PUZZLE') {
    fetch('https://lichess.org/api/puzzle/daily')
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('Fetch error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; 
  }
  
  if (request.action === 'FETCH_TRAINING_PUZZLE') {
    // Fetch a random puzzle from Lichess for training mode
    fetch('https://lichess.org/api/puzzle/next?difficulty=normal')
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('Fetch error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
});