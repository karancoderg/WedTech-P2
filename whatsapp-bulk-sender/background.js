// background.js

let queue = [];
let currentIndex = 0;
let isSending = false;
let activeTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_BULK') {
    if (isSending) {
      sendResponse({ error: "Already sending." });
      return true;
    }
    
    // First, verify we have a WhatsApp tab active
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0 || !tabs[0].url.includes("web.whatsapp.com")) {
        sendResponse({ error: "Please open this extension while on web.whatsapp.com" });
      } else {
        activeTabId = tabs[0].id;
        queue = message.payload;
        currentIndex = 0;
        isSending = true;
        
        chrome.storage.local.set({ queue, currentIndex, isSending });
        sendResponse({ success: true });
        
        processNext();
      }
    });
    return true; // Keep message channel open for async response
  }
  
  if (message.action === 'STOP_BULK') {
    stopBulk();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'MESSAGE_SENT' || message.action === 'INVALID_NUMBER') {
    if (isSending) {
      currentIndex++;
      chrome.storage.local.set({ currentIndex });
      
      // Delay before next to avoid rapid fire bans
      setTimeout(() => {
        processNext();
      }, 5000 + Math.random() * 3000); // 5-8 seconds delay
    }
    sendResponse({ success: true });
    return true;
  }
});

function processNext() {
  if (!isSending) return;
  
  if (currentIndex >= queue.length) {
    stopBulk();
    return;
  }
  
  const currentMessage = queue[currentIndex];
  const url = `https://web.whatsapp.com/send?phone=${currentMessage.phone}&text=${encodeURIComponent(currentMessage.message)}`;
  
  chrome.tabs.update(activeTabId, { url: url }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error("Tab update error", chrome.runtime.lastError);
      stopBulk();
    }
  });
}

function stopBulk() {
  isSending = false;
  chrome.storage.local.set({ isSending: false });
}
