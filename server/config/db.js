const mongoose = require('mongoose');

const connectDB = async () => {



    try {
        mongoose.set('strictQuery', false);
        // Add explicit options - family:4 forces IPv4 DNS resolution which can help
        // in some Windows/DNS environments. Mongoose uses sensible defaults otherwise.
        const conn = await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
        console.log(`Database Connected: ${conn.connection.host}`);
    } catch (error) {
        // Bubble the error up so the app startup halts when DB connection fails.
        console.error('Failed to connect to MongoDB:', error.message || error);
        throw error;
    }
}


module.exports = connectDB;