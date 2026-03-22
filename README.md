# WedSync — Indian Wedding RSVP & Guest Management Platform

WedSync is a full-stack, Next.js 14-powered web application designed specifically for managing Indian wedding workflows. It consolidates multiple, sprawling functions into one seamless platform for both wedding planners and guests.

> ### 🌐 **[Live Demo → https://wedsync1.vercel.app/](https://wedsync1.vercel.app/)**

## 🌟 Key Features

### For Wedding Planners (The Dashboard)
- **Wedding Creation Wizard:** Easily set up wedding details and define multiple functions (e.g., Haldi, Sangeet, Wedding, Reception).
- **Guest List Management:** Import CSVs or manually add guests. Specify which guest is invited to which function.
- **Bulk WhatsApp Invites:** Generate personalized WhatsApp message links natively, or use the accompanying Chrome Extension to completely automate sending hundreds of invites for free.
- **Advanced Realtime Analytics:** Track attendance (total pax), dietary restrictions, and hotel accommodation requests live as guests reply.
- **Check-In Kiosk & QR Scanner:** A blazing-fast check-in portal with `html5-qrcode` integration. Scan arrival QRs at the door and mark guests as present instantly.
- **Data Export:** Export detailed Excel reports with function-specific attendance and dietary data.

### For Guests (The Invite Experience)
- **Dynamic Theming:** Premium, Stitch-AI generated templates (`Floral`, `Royal`, `Minimal`) dynamically skin the guest experience based on the planner's choice.
- **Multi-Event RSVPs:** Function-by-function attendance selections. Collect plus-ones, dietary requirements, and accommodation needs all in one flow.
- **Event Passes:** Generating native QR code passes upon successful RSVP for day-of seamless entry.
- **Calendar & Share Integration:** Direct Add-to-Google-Calendar links and WhatsApp family sharing.

---

## 🛠️ Tech Stack
- **Framework:** [Next.js 14](https://nextjs.org/) (App Router, Turbopack)
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL, Row-Level Security, Realtime Subscriptions)
- **Authentication:** [Clerk](https://clerk.com/)
- **Styling:** Tailwind CSS, `shadcn/ui`, and customized CSS variable mapping for dynamic templates.
- **Add-on Tools:** `qrcode`, `html5-qrcode` (Scanning), `xlsx` (Excel processing), `sonner` (Toast notifications).

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js > 18.x
- A Supabase Project
- A Clerk Application

### 2. Environment Variables
Create a `.env.local` file in the `app` directory with the following variables:

```env
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# App Config
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Installation
Navigate into the application folder, install dependencies, and start the development server:
```bash
cd app
npm install
npm run dev
```

The application will be available at `http://localhost:3000`

---

## 🤖 How to use the WedSync Bulk Sender (Chrome Extension)

To bypass the need for an expensive Meta WhatsApp Business API integration, this project includes a custom Chrome Extension that automates WhatsApp Web to send hundreds of invitations automatically for free.

### Extention Installation Steps:
1. Open Google Chrome.
2. Navigate to `chrome://extensions`.
3. Toggle on **Developer mode** in the top right corner.
4. Click **Load unpacked** in the top left.
5. Select the `whatsapp-bulk-sender` folder located inside this repository.

### How to Send Bulk Invites:
1. Go to your WedSync Planner Dashboard and navigate to the **Guest List**.
2. Assuming you have added guests, click the checkboxes to select the guests you want to invite.
3. In the floating action bar at the bottom, click **Export for Extension**. (This copies the optimized JSON payload of names and customized messages to your clipboard).
4. Open a new tab and go to [web.whatsapp.com](https://web.whatsapp.com). Ensure you are logged into the WhatsApp account you wish to send invites from.
5. Click on the **WedSync Bulk Sender** extension icon in your Chrome toolbar.
6. Paste the contents of your clipboard into the text box.
7. Click **Start Sending**.

> **⚠️ Important Anti-Spam Note:** The extension automatically inserts a randomized 5 to 8 second delay between sending each message. This simulates human typing speed to prevent your personal WhatsApp account from being shadowbanned by Meta. *Do not close the WhatsApp Web tab while it is running.*
