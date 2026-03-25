const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
const fs = require('fs');
require('dotenv').config();

// 1. Initialize Firebase
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

const sessionState = new Map();

// A simple map of keywords to Document IDs
const keywords = {
    wifi: 'wifi_fix',
    internet: 'network_menu',
    audio: 'feedback_fix',
    mic: 'mic_power_fix',
    sound: 'feedback_fix',
    printer: 'printer_fix',
    email: 'email_sync_fix',
    outlook: 'email_sync_fix',
    freeze: 'editor_freeze_fix',
    slow: 'network_menu'
};

async function getMenuDoc(docId) {
    const doc = await db.collection('brain-bot').doc(docId).get();
    if (!doc.exists) {
        return null;
    }
    return doc.data();
}

const closingKeywords = [
    'worked',
    'works',
    'it works',
    'it worked',
    'fixed',
    'resolved',
    'solved',
    'ok',
    'okay',
    'all good',
    'thanks',
    'thank you',
    'thanks a lot',
    'appreciate'
];

const failureKeywords = [
    'not working',
    "didn't work",
    'did not work',
    'still not',
    'no change',
    'failed',
    'not fixed'
];

// 2. Initialize WhatsApp
const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('KBC Bot is live and connected to Firebase!');
});

// 3. The Logic (The Brain)
client.on('message', async msg => {
    const userId = msg.from;
    const rawInput = msg.body.trim();
    const input = rawInput.toLowerCase();

    // 1. The ticket collector
    if (sessionState.get(userId) === 'awaiting_ticket') {
        try {
            const ticketRef = await db.collection('tickets').add({
                staff_id: userId,
                issue_description: rawInput,
                status: 'Pending',
                priority: 'Normal',
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

            await msg.reply(`✅ *Ticket Logged: #${ticketRef.id.substring(0, 5)}*\n\nYour request has been sent to the KBC IT Department. An officer will be dispatched shortly.`);
            sessionState.set(userId, 'start');
            return;
        } catch (error) {
            console.error('Ticket error:', error);
            await msg.reply("❌ Sorry, I couldn't save your ticket. Please try again later.");
            return;
        }
    }

    // 2. The ticket trigger
    if (input === 'ticket' || input === 'help') {
        sessionState.set(userId, 'awaiting_ticket');
        await msg.reply("🎫 *KBC IT Helpdesk*\n\nPlease describe your problem in one message.\n*(Include your Studio/Office number and the Equipment ID if possible)*");
        return;
    }

    if (input === 'hi' || input === 'hello' || input === 'menu' || !sessionState.has(userId)) {
        sessionState.set(userId, 'start');
    }

    const currentState = sessionState.get(userId) || 'start';
    const normalizedInput = input === 'back' ? '0' : input;
    const isNumericInput = /^[0-9]+$/.test(normalizedInput);

    try {
        const data = await getMenuDoc(currentState);
        if (!data || !data.message) {
            await msg.reply('Menu message is missing. Reply "hi" to start over.');
            return;
        }

        const saidThanks = closingKeywords.some(keyword => input.includes(keyword));
        const saidFailure = failureKeywords.some(keyword => input.includes(keyword));

        if (saidFailure) {
            sessionState.set(userId, 'awaiting_ticket');
            await msg.reply("Sorry that didn't fix it. Please describe the issue in one message, and include your Studio/Office number and Equipment  if possible.");
            return;
        }

        // Auto-close or escalate when the user responds after a fix
        if (currentState.endsWith('_fix')) {
            if (saidThanks) {
                await msg.reply('Glad that worked. Thanks for confirming, and have a great day!');
                sessionState.set(userId, 'start');
                return;
            }

            if (saidFailure) {
                sessionState.set(userId, 'awaiting_ticket');
                await msg.reply("Sorry that didn't fix it. Please describe the issue in one message, and include your Studio/Office number and Equipment ID if possible.");
                return;
            }
        }

        if (saidThanks && currentState !== 'awaiting_ticket') {
            await msg.reply('Thanks for the update. If you need anything else, just say hi. Have a great day!');
            sessionState.set(userId, 'start');
            return;
        }

        // 1. Shortcut keyword search first
        let matchedState = null;
        if (!isNumericInput) {
            for (const key of Object.keys(keywords)) {
                if (input.includes(key)) {
                    matchedState = keywords[key];
                    break;
                }
            }
        }

        if (matchedState) {
            sessionState.set(userId, matchedState);
            console.log(`Search match: "${input}" -> ${matchedState}`);

            const matchedData = await getMenuDoc(matchedState);
            if (!matchedData || !matchedData.message) {
                await msg.reply('Menu message is missing. Reply "hi" to start over.');
                return;
            }

            await msg.reply(matchedData.message);
            return;
        }

        // 2. Handle numbered menu options
        if (normalizedInput === '0') {
            sessionState.set(userId, 'start');
            const startData = await getMenuDoc('start');
            if (!startData || !startData.message) {
                await msg.reply('Menu message is missing. Reply "hi" to start over.');
                return;
            }
            await msg.reply(startData.message);
            return;
        }

        if (data.options && data.options[normalizedInput]) {
            const nextState = data.options[normalizedInput];
            if (nextState === 'awaiting_ticket') {
                sessionState.set(userId, 'awaiting_ticket');
                await msg.reply("🎫 *KBC IT Helpdesk*\n\nPlease describe your problem in one message.\n*(Include your Studio/Office number and the Equipment ID if possible)*");
                return;
            }

            sessionState.set(userId, nextState);

            const nextData = await getMenuDoc(nextState);
            if (!nextData || !nextData.message) {
                await msg.reply('Menu message is missing. Reply "hi" to start over.');
                return;
            }

            await msg.reply(nextData.message);
            return;
        }

        // 3. Fallback to current menu message
        await msg.reply(data.message);
    } catch (error) {
        console.error('Search error:', error);
        await msg.reply('Something went wrong. Reply "hi" to start over.');
    }
});

client.initialize();