const http = require('http');
const url = require('url');
const { createClient, getClient, checkClientAuth, getClientQR } = require('./functions');

const PORT = 3000;

// Helper function to parse JSON body data
const parseRequestBody = (req) => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
    });
};

// Handler for the /api/create-client endpoint
async function handleCreateClient(body, res) {
    const { phone_number, state_code } = body;

    if (!phone_number || !state_code) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: 'Phone number and state code are required.' }));
    }

    try {
        const client = await createClient(phone_number);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: 'Client created successfully.',
            data: {
                user_hash: client.user_hash,
                qr_code: client.qr_code,
            },
        }));
    } catch (error) {
        console.error(error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Failed to create client: ' + error.message }));
    }
}

// Handler for the /api/send-message endpoint
async function handleSendMessage(body, res) {
    const { user_hash, message, recipient } = body;
    console.log('sendin message...');
    const client = getClient(user_hash);
    const phone_number = `972526033388@c.us`;

    if (!client) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: 'Client instance not found.' }));
    }

    client.on('ready', async () => {
        console.log('client ready');
        await client.sendMessage(phone_number, message);
        setTimeout(() => {
            client.destroy();
            console.log('client restarted');
        }, 1000);
    });
    client.initialize();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Message sent successfully.' }));
}

// Handler for the /api/check-authentication endpoint
async function handleCheckAuthentication(body, res) {
    const { user_hash } = body;

    const isAuth = checkClientAuth(user_hash);

    res.writeHead(isAuth ? 200 : 401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: isAuth,
        authenticated: isAuth,
        message: isAuth ? 'User is authenticated and ready.' : 'User is not authenticated. Please scan the QR code.',
        qr_code: !isAuth ? getClientQR(user_hash) : null,
    }));
}

// Main POST handler function
async function handlePostRequest(req, res, pathname) {
    const body = await parseRequestBody(req);

    switch (pathname) {
        case '/api/create-client':
            await handleCreateClient(body, res);
            break;
        case '/api/send-message':
            await handleSendMessage(body, res);
            break;
        case '/api/check-authentication':
            await handleCheckAuthentication(body, res);
            break;
        default:
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Route not found' }));
    }
}

// Main request handler function
const requestHandler = (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const { pathname } = parsedUrl;

    if (req.method === 'POST') {
        handlePostRequest(req, res, pathname).catch(error => {
            console.error(error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Internal Server Error' }));
        });
    } else {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }));
    }
};

// Create the HTTP server
const server = http.createServer(requestHandler);

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
