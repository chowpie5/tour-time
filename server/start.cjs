// Standalone chat server: `npm run chat-server` (PORT env var, default 4455).
// Deploy this on a machine every tour member can reach.
const path = require('path');
const { createChatServer } = require('./chat-server.cjs');

const port = Number(process.env.PORT) || 4455;
createChatServer({ port, dataDir: path.join(__dirname, 'data') });
console.log(`Tour Time chat server listening on ws://0.0.0.0:${port}`);
