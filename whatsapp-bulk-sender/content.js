// content.js
// Runs on https://web.whatsapp.com/*

let checkInterval = null;

function startLookingForSendButton() {
  clearInterval(checkInterval);
  let attempts = 0;
  const maxAttempts = 60; // 30 seconds wait
  
  checkInterval = setInterval(() => {
    attempts++;
    
    // 1. Look for Invalid number dialog
    const invalidDialog = document.evaluate(
      "//div[contains(text(), 'invalid') or contains(text(), 'Invalid')]", 
      document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;
    
    if (invalidDialog) {
      clearInterval(checkInterval);
      console.log("WedSync: Invalid number detected.");
      const okBtn = document.evaluate("//div[@role='button' and contains(., 'OK')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (okBtn) okBtn.click();
      
      chrome.runtime.sendMessage({ action: 'INVALID_NUMBER' });
      return;
    }

    // 2. Look for "Send" button
    // It is normally a span with data-icon="send"
    const sendIcon = document.querySelector('span[data-icon="send"]');
    const sendButton = sendIcon ? (sendIcon.closest('button') || sendIcon.parentElement) : document.querySelector('button[aria-label="Send"]');
    
    if (sendButton && !sendButton.disabled && sendButton.offsetWidth > 0) {
      clearInterval(checkInterval);
      
      console.log("WedSync: Found Send button. Clicking in 1s...");
      setTimeout(() => {
        sendButton.click();
        console.log("WedSync: Clicked send!");
        
        // Wait 2 seconds for message to actually leave the outbox
        setTimeout(() => {
          chrome.runtime.sendMessage({ action: 'MESSAGE_SENT' });
        }, 2000);
        
      }, 1000 + Math.random() * 1000);
    } else if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
      console.error("WedSync: Timeout waiting for send button.");
      chrome.runtime.sendMessage({ action: 'INVALID_NUMBER' });
    }
  }, 500);
}

function checkUrl() {
  if (window.location.href.includes('/send?phone=') && window.location.href.includes('text=')) {
    console.log("WedSync: Detected send URL, starting search.");
    startLookingForSendButton();
  }
}

// 1. Check immediately on script injection
checkUrl();

// 2. Listen for background script forcing a check
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'CHECK_SEND') {
    checkUrl();
  }
});

// 3. MutationObserver for Single Page App (SPA) navigations
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    checkUrl();
  }
}).observe(document, { subtree: true, childList: true });
