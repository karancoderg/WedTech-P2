# 📲 WedSync WhatsApp Bulk Sender

A **Manifest V3 Chrome Extension** that automates WhatsApp Web to send hundreds of personalised wedding invitations in bulk — completely **free**, with no expensive WhatsApp Business API required.

Built as a companion tool for the **[WedSync](../README.md)** Indian Wedding RSVP & Guest Management Platform. Planners export a structured JSON payload from the WedSync dashboard, paste it into the extension, and messages are sent automatically with human-like delays to prevent account bans.

**Target Users:** Wedding planners, event coordinators, students, and small businesses looking for a free bulk WhatsApp messaging solution.

---

## Table of Contents

1. [Features](#-1-features)
2. [Tech Stack](#-2-tech-stack)
3. [Installation Guide](#-3-installation-guide)
4. [How to Use](#-4-how-to-use-the-whatsapp-bulk-messaging-extension)
5. [Screenshots](#-5-screenshots)
6. [Project Structure](#-6-project-structure)
7. [Environment Variables](#-7-environment-variables)
8. [Configuration](#-8-configuration)
9. [Future Improvements](#-9-future-improvements)
10. [Contributing](#-10-contributing)
11. [License](#-11-license)

---

# 🚀 1. Features

| Feature | Description |
|---|---|
| **Bulk Message Sending** | Send personalised WhatsApp messages to hundreds of contacts in one automated session. |
| **Custom Message Templates** | Each guest receives a unique, personalised message exported from the WedSync dashboard. |
| **JSON-Based Contact Input** | Accepts a structured `[{phone, message}]` JSON array — paste from clipboard or type manually. |
| **Anti-Spam Delay Control** | Built-in randomised **5–8 second delay** between messages to mimic human behaviour. |
| **Invalid Number Auto-Skip** | Detects "number not on WhatsApp" errors, dismisses the dialog, and continues to the next contact. |
| **Real-Time Progress Tracking** | Live counter in the popup UI shows `Progress: X / Y sent ...` |
| **Stop Anytime** | Red "Stop Sending" button halts the process after the current message completes. |
| **Simple, User-Friendly Interface** | Clean 350px popup with a textarea, two buttons, and a status line — nothing complex. |
| **No Dependencies** | Pure vanilla JavaScript — no `npm install`, no build step, no frameworks. |

---

# 🛠️ 2. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Extension Standard | **Chrome Manifest V3** | Modern Chrome extension architecture with service workers and granular permissions. |
| Background Logic | **Service Worker** (`background.js`) | Queue management, WhatsApp Web tab navigation, 5–8s delay orchestration, state persistence via `chrome.storage`. |
| Content Script | **DOM Automation** (`content.js`) | Injected into WhatsApp Web. Detects the Send button via DOM queries, clicks it, and handles invalid-number dialogs. |
| Popup UI | **HTML + CSS + JS** (`popup.html`, `popup.js`) | Extension popup panel for JSON input, start/stop controls, and real-time progress display. |
| State Persistence | **`chrome.storage.local`** | Persists the send queue, current index, and sending state across popup opens/closes. |
| Communication | **`chrome.runtime` Messaging** | Message passing between popup → background → content script for coordinated automation. |
| Language | **Vanilla JavaScript (ES6+)** | Lightweight, zero-dependency implementation. No build tools required. |

---

# 📦 3. Installation Guide

## 3.1 Clone the Repository

```bash
git clone https://github.com/your-username/WedTech.git
cd WedTech/app/whatsapp-bulk-sender
```

> If you already have the WedTech project, navigate directly to `app/whatsapp-bulk-sender`.

## 3.2 Install Dependencies

```bash
# No dependencies to install! 🎉
# This extension is pure vanilla JavaScript with zero npm packages.
```

## 3.3 Load the Extension in Chrome

Follow these steps exactly:

1. Open **Google Chrome** (or any Chromium browser — Edge, Brave, etc.).
2. Type `chrome://extensions/` in the address bar and press **Enter**.
3. Toggle **"Developer mode"** ON using the switch in the **top-right corner**.
4. Click the **"Load unpacked"** button in the **top-left**.
5. In the file picker dialog, navigate to and select the `whatsapp-bulk-sender` folder.
6. ✅ The extension will appear in your extensions list with the name **"WedSync WhatsApp Bulk Sender"**.

> **💡 Tip:** Pin the extension for easy access — click the puzzle-piece icon (🧩) in Chrome's toolbar → find **WedSync WhatsApp Bulk Sender** → click the 📌 pin icon.

---

# 📲 4. How to Use the WhatsApp Bulk Messaging Extension

> 🧑‍💻 **This guide assumes you are a complete beginner.** Follow every step exactly as written.

---

## Step 1: Open WhatsApp Web

1. Open a **new tab** in Google Chrome.
2. Go to **[https://web.whatsapp.com](https://web.whatsapp.com)**.
3. On your phone, open **WhatsApp** → tap **⋮ (three dots)** → **Linked Devices** → **Link a Device**.
4. Scan the **QR code** displayed on the computer screen.
5. **Wait** until all your chats are fully loaded.

> ⚠️ **IMPORTANT:** Do **NOT** close this WhatsApp Web tab at any point during the sending process. The extension automates this exact tab.

---

## Step 2: Open the Extension

1. Make sure you are on the **WhatsApp Web tab** (the URL should show `web.whatsapp.com`).
2. Click the **WedSync Bulk Sender** icon in your Chrome toolbar.
3. A **popup panel** will open with:
   - A **text area** for pasting your JSON data
   - A green **"Start Sending"** button
   - A status line showing **"Ready."**

---

## Step 3: Add Contacts (Prepare Your JSON Payload)

The extension accepts a **JSON array** where each object has two fields:

| Field | Type | Description | Example |
|---|---|---|---|
| `phone` | String | Phone number in **international format** (digits only, no `+`, no spaces) | `"919876543210"` |
| `message` | String | The personalised message to send to this contact | `"Hi Priya! You're invited..."` |

### Option A: Export from WedSync Dashboard ✅ (Recommended)

1. Open the **WedSync Planner Dashboard** → go to your **Guest List**.
2. Select the guests you want to invite using the **checkboxes**.
3. Click **"Export for Extension"** in the floating action bar at the bottom.
4. The JSON payload is now **copied to your clipboard** — ready to paste in Step 4.

### Option B: Create JSON Manually

Create the JSON array in any text editor:

```json
[
  {
    "phone": "919876543210",
    "message": "Hello Priya! You are cordially invited to Aman & Neha's wedding on 15th March 2026. Please RSVP here: https://wedsync.app/invite/abc123"
  },
  {
    "phone": "919123456789",
    "message": "Hello Rahul! You are cordially invited to Aman & Neha's wedding on 15th March 2026. Please RSVP here: https://wedsync.app/invite/def456"
  },
  {
    "phone": "14155552671",
    "message": "Hi Sarah! You're invited to Aman & Neha's wedding celebration. RSVP: https://wedsync.app/invite/ghi789"
  }
]
```

> **📌 Phone Number Format Rules:**
> - Use **international format** — country code + number, **no `+` sign**, **no spaces**, **no dashes**.
> - India: `91` + 10-digit number → `919876543210`
> - USA: `1` + 10-digit number → `14155552671`
> - UK: `44` + number → `447911123456`

---

## Step 4: Paste the JSON & Write Your Message Template

1. Click inside the **text area** in the extension popup.
2. Press **Ctrl + V** (Windows/Linux) or **Cmd + V** (Mac) to paste your JSON.
3. The text area should now display your array of `{phone, message}` objects.

**Example of what you should see in the text area:**

```json
[{"phone":"919876543210","message":"Hi Priya! You're invited to Aman & Neha's wedding! 🎉 RSVP: https://wedsync.app/invite/abc123"},{"phone":"919123456789","message":"Hi Rahul! You're invited to Aman & Neha's wedding! 🎉 RSVP: https://wedsync.app/invite/def456"}]
```

> **💡 Message Tips:**
> - Messages support **emojis** (🎉💒🥳), **URLs**, and **line breaks** (`\n`).
> - Each message is unique per guest (pre-personalised by WedSync) — no placeholders needed.
> - Keep messages friendly and personal to avoid being flagged as spam.

---

## Step 5: Understand the Settings

The extension has **pre-configured anti-spam settings** that cannot be adjusted from the UI (by design, for your safety):

| Setting | Value | Purpose |
|---|---|---|
| **Delay between messages** | 5–8 seconds (randomised) | Mimics human typing speed to avoid WhatsApp bans. |
| **Send button wait timeout** | 30 seconds | Maximum time to wait for WhatsApp to load the chat and show the Send button. |
| **Pre-click pause** | 1–2 seconds (randomised) | Brief pause before clicking Send for natural behaviour. |
| **Post-send confirmation** | 2 seconds | Waits for the message to leave the outbox before proceeding. |

> These delays are **intentionally not configurable** from the popup to prevent accidental misuse.

---

## Step 6: Start Bulk Sending

1. Click the green **"Start Sending"** button.
2. **What happens automatically:**
   - The WhatsApp Web tab navigates to the first contact's chat (using the `wa.me/send?phone=&text=` URL scheme).
   - WhatsApp Web loads the chat and pre-fills the message.
   - The content script detects the **Send button** and clicks it.
   - The extension waits **5–8 seconds** (random), then navigates to the next contact.
   - This repeats until all messages are sent.
3. The **Start button** becomes greyed out, and a red **"Stop Sending"** button appears.

> 🕐 **Time Estimate:** ~7 seconds per message. For **100 guests** ≈ **12 minutes**. For **300 guests** ≈ **35 minutes**.

---

## Step 7: Monitor Progress

- The popup displays a **live progress counter**: `Progress: 12 / 50 sent ...`
- If you **close the popup** and reopen it, the progress is preserved (stored in `chrome.storage`).
- **Invalid numbers**: If a contact isn't on WhatsApp, the extension automatically:
  1. Detects the error dialog.
  2. Clicks "OK" / "Close".
  3. Logs the skip.
  4. Moves to the next contact.
- Once all messages are sent, the status shows: **"Finished sending or stopped."**

### Stopping Early (Optional)

- Click the red **"Stop Sending"** button at any time.
- The extension will finish the current message, then halt.
- The Start button becomes active again for a future session.

---

## ⚠️ Anti-Spam Warning & WhatsApp Policy

> **🚨 READ THIS BEFORE SENDING**

| ⚠️ Rule | Details |
|---|---|
| **Do NOT close the WhatsApp Web tab** | The extension automates this specific tab. Closing it breaks the process. |
| **Do NOT reduce the delay** | The 5–8 second delay is carefully calibrated. Going below 5s **will** trigger WhatsApp's anti-spam detection. |
| **Do NOT send to strangers** | Only message contacts you have a legitimate reason to reach (e.g., wedding guests). |
| **Start small** | Test with **5–10 contacts** first before sending to hundreds. |
| **Keep messages personalised** | Identical messages sent to many numbers are flagged. WedSync generates unique messages per guest automatically. |
| **Avoid peak hours** | Sending 500+ messages during high-traffic times increases monitoring risk. |
| **Respect WhatsApp Terms** | WhatsApp's [Terms of Service](https://www.whatsapp.com/legal/terms-of-service) prohibit automated bulk messaging. **Use at your own risk.** |
| **Misuse = Account Ban** | WhatsApp can **temporarily or permanently ban** accounts detected sending spam. We are not responsible. |

---

# 📸 5. Screenshots

```
📷 Screenshots coming soon — will be added after first production deployment.
```

<!--
Uncomment and add real paths after adding screenshots:
![Extension Popup UI](./screenshots/popup-ui.png)
![Progress Tracking](./screenshots/progress.png)
![WhatsApp Web Automation](./screenshots/automation.png)
-->

---

# 📂 6. Project Structure

```bash
whatsapp-bulk-sender/
├── manifest.json        # Chrome Extension manifest (Manifest V3)
├── background.js        # Service Worker — send queue & delay orchestration
├── content.js           # Content Script — WhatsApp Web DOM automation
├── popup.html           # Extension popup UI panel (350px)
├── popup.js             # Popup logic — JSON validation, controls, progress
└── README.md            # This documentation file
```

### Detailed File Responsibilities

| File | Role | Key Functions |
|---|---|---|
| `manifest.json` | **Extension configuration.** Declares permissions (`storage`, `tabs`, `scripting`), scopes host access to `web.whatsapp.com`, registers the service worker and content script. | — |
| `background.js` | **Orchestrator.** Receives the JSON queue from the popup via `chrome.runtime.onMessage`. Navigates the WhatsApp Web tab to each contact using the URL scheme `web.whatsapp.com/send?phone=&text=`. Enforces randomised 5–8s delays between messages. Manages start/stop state via `chrome.storage.local`. | `processNext()`, `stopBulk()` |
| `content.js` | **DOM Automator.** Injected into WhatsApp Web at `document_idle`. Uses `MutationObserver` + `setInterval` polling to detect two scenarios: (a) the Send button (`span[data-icon="send"]`) → clicks it, or (b) "Invalid number" / "Not on WhatsApp" dialogs → dismisses them. Reports `MESSAGE_SENT` or `INVALID_NUMBER` back to `background.js`. | `startLookingForSendButton()`, `checkUrl()` |
| `popup.html` | **UI Panel.** A 350px-wide popup with a monospace textarea (for JSON input), a WhatsApp-green Start button, a red Stop button (hidden by default), and a status line. | — |
| `popup.js` | **Popup Controller.** Validates JSON input (must be a non-empty array of `{phone, message}` objects). Dispatches `START_BULK` / `STOP_BULK` messages to the service worker. Listens for `chrome.storage.onChanged` events to update the progress display in real time. | — |

### Communication Flow Between Files

```
popup.js  ──START_BULK──►  background.js  ──tab.update(url)──►  WhatsApp Web
                                                                     │
                           background.js  ◄──MESSAGE_SENT──  content.js
                                │
                           (5-8s delay)
                                │
                           background.js  ──tab.update(url)──►  Next contact...
```

---

# 🔐 7. Environment Variables

## 7.1 Why Environment Variables Are Used

Environment variables allow you to:
- **Store configuration separately** from source code.
- **Improve security** by keeping sensitive data out of version control.
- **Enable flexibility** by adjusting settings per environment (development vs production).

## 7.2 Current Status

> **This Chrome Extension does NOT use environment variables.** All configuration is hardcoded in the source files for simplicity and security.

Since this is a **client-side Chrome Extension** with no server component:
- There is **no `.env` file**.
- There is **no `process.env`** or `import.meta.env` available.
- All sensitive data (phone numbers, messages) is processed **entirely in-browser** and never sent to any external server.

## 7.3 Configurable Constants (Hardcoded)

Instead of environment variables, the extension uses hardcoded constants in the source files:

| Variable | Default Value | File | Line | Description |
|---|---|---|---|---|
| `MESSAGE_DELAY` | `5000 + Math.random() * 3000` (5–8s) | `background.js` | 47 | Delay between sending consecutive messages. |
| `MAX_WAIT_ATTEMPTS` | `60` (× 500ms = 30s) | `content.js` | 9 | Maximum time to wait for WhatsApp to load the Send button. |
| `POST_SEND_WAIT` | `2000` ms | `content.js` | 53 | Time to wait after clicking Send before reporting success. |
| `PRE_CLICK_DELAY` | `1000 + Math.random() * 1000` (1–2s) | `content.js` | 57 | Random pause before clicking the Send button. |

## 7.4 Example `.env` (For Future Use)

If the extension is upgraded to include a backend server component in the future:

```env
# .env.example
WHATSAPP_DELAY=5000
EXTENSION_MODE=development
API_ENDPOINT=http://localhost:3000/api
```

## 7.5 Best Practices

- ✅ **Do NOT commit** `.env` files to version control.
- ✅ **Add `.env` to `.gitignore`** to prevent accidental commits.
- ✅ **Use `.env.example`** as a template for required variables (with empty values).
- ✅ **Store secrets** (API keys, tokens) server-side, never in extension code.

## 7.6 Accessing Variables in Code (Reference)

In a **Chrome Extension** context, standard `process.env` is **not available**. If you need configurable settings in the future, use:

```javascript
// Store in chrome.storage.local
chrome.storage.local.set({ WHATSAPP_DELAY: 5000 });

// Retrieve
chrome.storage.local.get(['WHATSAPP_DELAY'], (result) => {
  const delay = result.WHATSAPP_DELAY || 5000;
});
```

For a **Node.js build step** (if added later):

```javascript
// Using dotenv
require('dotenv').config();
const delay = process.env.WHATSAPP_DELAY || 5000;
```

---

# ⚙️ 8. Configuration

## Adjustable Settings

Since there's no settings UI, the following values can be adjusted by **editing the source code directly**:

### Message Delay (background.js, line 47)

```javascript
// Default: 5000 + random(0-3000) = 5-8 seconds between messages
setTimeout(() => {
  processNext();
}, 5000 + Math.random() * 3000);
```

> ⚠️ **WARNING:** Reducing the delay below 5 seconds **significantly increases** the risk of WhatsApp banning your account. Do NOT change this unless you fully understand the consequences.

### Send Button Detection Timeout (content.js, line 9)

```javascript
const maxAttempts = 60; // 60 attempts × 500ms = 30 seconds maximum wait
```

> Increase this if you have a slow internet connection and WhatsApp takes longer to load chats.

### JSON Payload Schema

The extension validates input against this exact format:

```json
[
  { "phone": "string (digits only, international format)", "message": "string" }
]
```

**Constraints:**
- Must be a valid **JSON array** (starts with `[`, ends with `]`).
- Must contain at least **one object**.
- Each object **must** have both `phone` and `message` keys.
- `phone` must be **digits only** — no `+`, spaces, dashes, or parentheses.

---

# 🧪 9. Future Improvements

| Improvement | Priority | Status |
|---|---|---|
| **CSV file upload** — import contacts directly from a spreadsheet | High | 🔜 Planned |
| **Delivery confirmation logging** — track sent / failed / skipped | High | 🔜 Planned |
| **Message template editor** — support `{{name}}`, `{{event}}` placeholders | Medium | 💡 Idea |
| **Scheduled sending** — set a specific time to start the batch | Medium | 💡 Idea |
| **Analytics dashboard** — visual charts of sent / delivered / read stats | Medium | 💡 Idea |
| **Media attachments** — send images, PDFs, or invitation cards | Low | 💡 Idea |
| **Firefox / Edge ports** — cross-browser compatibility | Low | 💡 Idea |
| **Settings UI** — in-popup controls for delay, batch size, etc. | Low | 💡 Idea |
| **Retry failed messages** — automatic retry queue for timed-out sends | Low | 💡 Idea |

---

# 🤝 10. Contributing

Contributions are welcome! Here's how to get started:

### Step 1: Fork & Clone

```bash
git fork https://github.com/your-username/WedTech.git
git clone https://github.com/YOUR-USERNAME/WedTech.git
cd WedTech/app/whatsapp-bulk-sender
```

### Step 2: Create a Feature Branch

```bash
git checkout -b feature/csv-upload
```

### Step 3: Make Changes

Edit files in the `whatsapp-bulk-sender/` directory.

### Step 4: Test Thoroughly

1. Go to `chrome://extensions/` → click the **refresh icon** (🔄) on the extension card.
2. Open WhatsApp Web → test with **2–3 contacts** first.
3. Check the browser console for any errors:
   - **background.js logs:** `chrome://extensions/` → click **"service worker"** link.
   - **content.js logs:** Open WhatsApp Web → press `F12` → Console tab (logs prefixed with `WedSync:`).
   - **popup.js logs:** Right-click the popup → **Inspect** → Console tab.

### Step 5: Commit & Push

```bash
git add .
git commit -m "feat: add CSV upload support to popup"
git push origin feature/csv-upload
```

### Step 6: Open a Pull Request

Go to the original repository and open a **Pull Request** with a clear description of your changes.

### Code Style

- Use **vanilla JavaScript** (ES6+) — no TypeScript, no frameworks.
- Use **meaningful variable names** and add comments for complex logic.
- Prefix all console logs with `WedSync:` for easy filtering.
- Test with both valid and invalid phone numbers.

---

# 📜 11. License

This project is part of the **WedSync** platform and is provided under the **MIT License**.

```
MIT License

Copyright (c) 2026 WedSync

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

> **Built with ❤️ for Indian weddings** | Part of the [WedSync](../README.md) platform | IIT Mandi
