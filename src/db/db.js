// mongoose is basically a bridge between Node.js and MongoDB
// without it we'd have to write raw mongo queries which is pain

const mongoose = require('mongoose');

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Database Connected Successfully');
    } catch (err) {
        console.error('Database Connection error:', err);
    }
}

module.exports = connectDB;
