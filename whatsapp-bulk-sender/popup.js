document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const jsonInput = document.getElementById('jsonInput');
  const statusDiv = document.getElementById('status');

  // Load state
  chrome.storage.local.get(['isSending', 'queue', 'currentIndex'], (result) => {
    if (result.isSending) {
      jsonInput.disabled = true;
      startBtn.disabled = true;
      stopBtn.style.display = 'block';
      updateStatusDisplay(result.currentIndex, result.queue ? result.queue.length : 0);
    }
  });

  // Listen for progress updates
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.isSending && changes.isSending.newValue === false) {
        jsonInput.disabled = false;
        startBtn.disabled = false;
        stopBtn.style.display = 'none';
        statusDiv.innerText = "Finished sending or stopped.";
      }
      if (changes.currentIndex && changes.queue) {
        updateStatusDisplay(changes.currentIndex.newValue, changes.queue.newValue.length);
      } else {
        chrome.storage.local.get(['currentIndex', 'queue'], (res) => {
           if(res.queue) updateStatusDisplay(res.currentIndex, res.queue.length);
        });
      }
    }
  });

  function updateStatusDisplay(idx, total) {
    statusDiv.innerText = `Progress: ${idx} / ${total} sent ...`;
  }

  startBtn.addEventListener('click', () => {
    let data = [];
    try {
      data = JSON.parse(jsonInput.value.trim());
      if (!Array.isArray(data) || data.length === 0) throw new Error("Empty array");
      if (!data[0].phone || !data[0].message) throw new Error("Invalid format. Need phone and message.");
    } catch (e) {
      statusDiv.innerText = "Error: Invalid JSON format. Must be an array of objects with 'phone' and 'message'.";
      statusDiv.style.color = "red";
      return;
    }

    statusDiv.style.color = "#475569";
    chrome.runtime.sendMessage({ action: 'START_BULK', payload: data }, (response) => {
      if (response && response.error) {
        statusDiv.innerText = "Error: " + response.error;
        statusDiv.style.color = "red";
      }
    });

    jsonInput.disabled = true;
    startBtn.disabled = true;
    stopBtn.style.display = 'block';
  });

  stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'STOP_BULK' });
  });
});
