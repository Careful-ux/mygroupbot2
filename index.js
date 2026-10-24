const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const P = require('pino');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    
    const sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    sock.ev.on('creds.update', saveCreds);

    // If not connected, ask for pairing code
    if (!sock.authState.creds.registered) {
        console.log('Enter your WhatsApp number with country code, e.g 233XXXXXXXXX');
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const question = (text) => new Promise((resolve) => readline.question(text, resolve));
        const phoneNumber = await question('Your number: ');
        readline.close();
        
        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(`\nYour pairing code is: ${code}\n`);
        console.log('Go to WhatsApp > Linked devices > Link with phone number > Enter code');
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ Bot is connected! Now test .ping in group');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;
            const chat = msg.key.remoteJid;
            if (!chat || !chat.endsWith('@g.us')) continue;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

            if (text.trim() === '.ping') {
                await sock.sendMessage(chat, { text: '🏓 Pong! Bot is online.' });
            }
            if (text.trim() === '.menu') {
                await sock.sendMessage(chat, { text: '🤖 MENU\n.ping - check\n.menu - menu\n.tagall - tag all' });
            }
        }
    });
}

startBot();

