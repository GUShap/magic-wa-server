const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient, getClient, checkClientAuth, getClientQR, restartServer } = require('./functions');


const app = express();
const PORT = 3000;
const PUBLIC_DOMAIN = typeof process.env.RAILWAY_PUBLIC_DOMAIN !== 'undefined' ? process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:3000';
app.use(bodyParser.json());
app.use(cors());

// Define the /api/create-client route
app.post('/api/create-client', async (req, res) => {
    const { phone_number, state_code } = req.body;
    const sourceURL = req.headers.origin;
    console.log(`got a call from ${sourceURL}...`);
    // Check for required fields
    if (!phone_number || !state_code) {
        return res.status(400).json({ success: false, message: 'Phone number and state code are required.' });
    }

    // Create a hash for the phone number
    console.log(phone_number, state_code);
    try {
        // Create the client and get the QR code
        const client = await createClient(phone_number, sourceURL); // Wait for the QR code to be generated
        // Store the hash
        res.json({
            success: true,
            message: 'Client created successfully.',
            data: {
                user_hash: client.user_hash, // Return the hash to the client
                qr_code: client.qr_code, // Return the generated QR code
            },
        });
        console.log('all good');
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to create client: ' + error.message,
        });
    }
});

// Define the /api/send-message route
app.post('/api/send-message', async (req, res) => {
    const { user_hash, message, recipient } = req.body;
    console.log('sending message...');
    // Find the user ID from the hash

    // Get the client's instance using the userId
    const client = getClient(user_hash);
    // Phone number to send the message to (for testing, hardcoded number)
    const phone_number = `${recipient}@c.us`;  // WhatsApp uses '@c.us' suffix for contacts
    if (!client) {
        console.log('client not found');
        return res.status(404).json({ success: false, message: 'Client instance not found.' });
    }

    client.on('ready', async () => {
        await client.sendMessage(phone_number, message);
        console.log('message sent, Restarting client...');
        setTimeout(() => {
            client.destroy();
            console.log('client restarted');
        }, 10000);
    });

    client.initialize();
    console.log('client initialized, moving on...');
});

app.post('/api/send-messages', async (req, res) => {
    console.log('sending messages...');

    const { user_hash, messages_data } = req.body;
    const client = getClient(user_hash);

    if (!client) {
        console.log('client not found');
        return res.status(404).json({ success: false, message: 'Client instance not found.' });
    }


    client.on('ready', async () => {
        console.log(messages_data);
        for (const [recipient, message] of Object.entries(messages_data)) {
            if (!recipient || !message) return;
            const phone_number = `${recipient}@c.us`;
            await client.sendMessage(phone_number, message);
        }
        console.log('messages sent, Restarting client...');
        setTimeout(() => {
            client.destroy();
            console.log('client restarted');
        }, 10000);
    });

    client.initialize();
    console.log('client initialized, moving on...');

});

// Define the /api/check-authentication route
app.post('/api/check-authentication', (req, res) => {
    const { user_hash } = req.body;
    console.log('checking auth...');

    // Find the user ID from the hash
    const isAuth = checkClientAuth(user_hash);

    if (!isAuth) {
        console.log('not authenticated');
        return res.status(401).json({
            success: false,
            authenticated: false,
            qr_code: getClientQR(user_hash),
            message: 'User is not authenticated yet. Please scan the QR code.'
        });
    }
    // Check the authentication status
    return res.json({
        success: true,
        authenticated: true,
        message: 'User is authenticated and ready.'
    });
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on ${PUBLIC_DOMAIN}`);
});