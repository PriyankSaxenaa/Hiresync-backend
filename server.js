require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/db/db');
const { initSocket } = require('./src/config/socket');

// connect to mongo first
connectDB();

// wrap express in a raw http server so Socket.IO can share the same port
const server = http.createServer(app);

// start Socket.IO and make `io` reachable from controllers via app.get('io')
const io = initSocket(server);
app.set('io', io);

server.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
});
