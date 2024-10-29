const { Client, LocalAuth } = require('whatsapp-web.js');
const crypto = require('crypto');

const clients = {};
const hashes = {}; // Store hashes for cracking later
// Function to create a hash of the phone number
function createHash(phone_number) {
    return crypto.createHash('sha256').update(phone_number).digest('hex');
}

function storeHash(user_hash) {
    hashes[user_hash] = user_hash;
}

// Function to create a new WhatsApp client
async function createClient(phone_number) {
    const user_hash = createHash(phone_number);
    const userId = user_hash; // Example user ID
    const client = new Client({
        puppeteer: { headless: true }, // Set to true for headless mode
        authStrategy: new LocalAuth({ clientId: userId }),
    });

    return new Promise((resolve, reject) => {
        // Handle QR event
        client.on('qr', (qr) => {
            // Store the QR code for the client
            clients[userId] = { phone_number, qr_code: qr, authenticated: false };
            storeHash(user_hash);
            // Resolve the promise with the QR code
            resolve({ qr_code: qr, user_hash });
        });

        client.on('ready', () => {
            console.log(`Client ${userId} is ready!`);
            clients[userId].authenticated = true;  // Mark as authenticated
        });

        client.on('auth_failure', () => {
            reject(new Error('Authentication failed.'));
        });

        client.initialize();

        // Store the client instance
        clients[userId] = { phone_number: phone_number, qr_code: '', authenticated: false };
    });
}

function getClient(userId) {
    return new Client({
        puppeteer: { headless: true }, // Set to true for headless mode
        authStrategy: new LocalAuth({ clientId: userId }),
    });
}

function getUserID(user_hash) {
    const userId = hashes[user_hash];
    return userId;
}

function checkClientAuth(userId) {
    // console.log(userId);
    // check if key exists
    if (!clients[userId]) {
        return false;
    }
    // console.log(clients[userId].authenticated);

    // if (!clients[userId].hasOwnProperty(authenticated)) {
    //     clients[userId].authenticated = false;
    //     return false;
    // }


    return clients[userId].authenticated;
}

function getClientQR(userId) {
    return clients[userId].qr_code;
}

function restartServer(app, port){
    app.close(()=>{
        console.log('Server closed');
        app.listen(port, ()=>{
            console.log('Server restarted');
        });
    });
}
module.exports = { createHash, storeHash, createClient, getUserID, getClient, checkClientAuth, getClientQR,restartServer };