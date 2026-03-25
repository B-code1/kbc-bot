const admin = require('firebase-admin');
const fs = require('fs');
require('dotenv').config();

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  throw new Error('Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS in .env');
}

const serviceAccount = getServiceAccount();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const menuData = [
 
  {
    id: 'start',
    message: "Jambo!! Welcome to KBC IT Support! 🤖\nYou can reply with a number below, or type your problem directly (e.g., 'printer jam' or 'mic not working').\n\n1. Internet/Network\n2. Hardware (PC/Printer)\n3. Studio/Broadcast Equipment\n4. Password Recovery\n5. Password Reset (Change Password)\n6. Login/Authentication Issues",
    options: {
      '1': 'network_menu',
      '2': 'hardware_menu',
      '3': 'studio_menu',
      '4': 'password_recovery',
      '5': 'password_reset',
      '6': 'auth_fix'
    }
  },

  // --- STUDIO & BROADCAST BRANCH ---
  {
    id: 'studio_menu',
    message: "🎙️ *Studio & Broadcast Support*\n1. Audio Feedback (Screeching)\n2. Silent Microphone\n3. Blurred Live Stream\n0. Back to Main Menu",
    options: { '1': 'feedback_fix', '2': 'mic_power_fix', '3': 'stream_blur_fix', '0': 'start' }
  },
  {
    id: 'feedback_fix',
    message: "🔊 *Stopping Audio Feedback:*\n1. **Mute Speakers:** Ensure monitors are OFF when the mic is LIVE.\n2. **Check Headphones:** If guest headphones are too loud near the mic, a loop is created.\n3. **Distance:** Move the mic away from any speakers.\n\n*Why?* The mic is 'hearing' the speakers and creating a sound loop.",
    options: { '0': 'studio_menu' }
  },
  {
    id: 'mic_power_fix',
    message: "🎙️ *No Microphone Signal?*\n1. **Find +48V:** Look for the 'Phantom' or '+48V' button on your mixer.\n2. **Toggle ON:** Condenser mics need electricity to wake up.\n3. **Check XLR:** Ensure you are using a 3-pin XLR cable.\n\n*Why?* Professional KBC mics require 'Phantom Power' to work.",
    options: { '0': 'studio_menu' }
  },
  {
    id: 'stream_blur_fix',
    message: "📡 *Improving Stream Quality:*\n1. **Stop Downloads:** Ensure no one else is using the studio bandwidth.\n2. **Use LAN:** Never stream over Wi-Fi; always plug in the Ethernet cable.\n3. **Lower Bitrate:** In OBS/Vmix, set bitrate to 4000kbps.\n\n*Why?* Video data is like water; if the 'pipe' (internet) is too small, it gets squeezed and blurry.",
    options: { '0': 'studio_menu' }
  },

  
  {
    id: 'hardware_menu',
    message: "💻 *Hardware & Software*\n1. Editing App Frozen (Premiere/Dalet)\n2. Email Sync Error (Outlook)\n3. Printer Jam\n0. Back to Main Menu",
    options: { '1': 'editor_freeze_fix', '2': 'email_sync_fix', '3': 'printer_fix', '0': 'start' }
  },
  {
    id: 'editor_freeze_fix',
    message: "🎬 *Fixing Video App Freezes:*\n1. **Clear Cache:** In Premiere, go to Preferences > Media Cache and click 'Delete'.\n2. **Drive Space:** Ensure your 'C:' drive isn't red/full.\n3. **Restart:** Clears the RAM for a fresh start.\n\n*Why?* High-def video needs 'scratch space' on your hard drive to process files.",
    options: { '0': 'hardware_menu' }
  },
  {
    id: 'email_sync_fix',
    message: "📧 *Outlook Sync Fix:*\n1. **Check Connection:** If it says 'Offline', click Send/Receive > Work Offline to toggle it.\n2. **Password:** Re-enter your KBC staff credentials in Account Settings.\n3. **Safe Mode:** Hold 'Ctrl' while opening Outlook to bypass errors.\n\n*Why?* This re-verifies your identity with the KBC mail server.",
    options: { '0': 'hardware_menu' }
  },
  {
    id: 'printer_fix',
    message: "🖨️ *Clearing a Printer Jam:*\n1. **Power Off:** Turn the printer off to stop rollers.\n2. **Open Access Panels:** Check front, rear, and tray paths.\n3. **Remove Paper Gently:** Pull in the direction of normal paper flow.\n4. **Check for Scraps:** Even small torn pieces can cause repeat jams.\n\n*Why?* Rollers grab paper in one direction; pulling the wrong way can damage them.",
    options: { '0': 'hardware_menu' }
  },
  {
    id: 'password_reset',
    message: "🔐 *Password Reset (Change Password):*\n1. **Open the Reset Page:** Use the reset link from recovery or the KBC reset page.\n2. **Enter the Code:** If you received a code, type it in exactly.\n3. **Create a New Password:** At least 12 characters, mix letters and numbers.\n4. **Sign In Again:** Use the new password on email/VPN/PC.\n\n*Why?* Reset updates your account across KBC services.",
    options: { '0': 'start' }
  },
  {
    id: 'password_recovery',
    message: "📨 *Password Recovery:*\n1. **Click the Reset Link:** Open the KBC password recovery link.\n2. **Enter Your Email:** Use your official KBC staff email.\n3. **Verify:** Complete the OTP or security check.\n4. **Check Inbox:** Look for the reset email and follow the link.\n\n*Why?* Recovery confirms you own the account before a reset.",
    options: { '0': 'start' }
  },
  {
    id: 'auth_fix',
    message: "✅ *Authentication/Login Issues:*\n1. **Check Caps/Keyboard:** Ensure Caps Lock and keyboard layout are correct.\n2. **Confirm Account Status:** Try signing in to webmail or VPN to confirm access.\n3. **Clear Cached Credentials:** In Windows, open Credential Manager and remove old KBC entries.\n\n*Why?* Cached passwords often cause repeated login failures after a change.",
    options: { '0': 'start' }
  },
  {
    id: 'wifi_fix',
    message: "Try these:\n1. Toggle Wi-Fi OFF/ON.\n2. Reconnect to KBC-Staff.\n\n*If these steps failed, reply '9' to talk to a technician.*",
    options: {
      '0': 'start',
      '9': 'awaiting_ticket'
    }
  }

];

async function uploadData() {
  for (const item of menuData) {
    const { id, ...data } = item;
    await db.collection('brain-bot').doc(id).set(data);
    console.log(`✅ Uploaded: ${id}`);
  }
  console.log(' All brain data uploaded to KBC Firebase!');
  process.exit();
}

uploadData();