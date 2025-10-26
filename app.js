require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const expressLayout = require('express-ejs-layouts');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const MongoStore = require('connect-mongo');
const connectDB = require('./server/config/db');

const { isActiveRoute } = require('./server/helpers/routeHelpers');

const app = express();

// Prefer environment PORT, fallback to 5000
const PORT = process.env.PORT || 5000;

async function start() {
    // Wait for mongoose to fully connect so we can reuse the client for the session store
    await connectDB(); // connect to db

    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(cookieParser());

    app.use(methodOverride('_method'));

    // Use the underlying MongoClient from mongoose connection as the store client
    // This avoids needing to re-specify the URL and ensures the client is available
    const mongoClient = mongoose.connection.getClient && mongoose.connection.getClient();
    const storeOptions = {};
    if (mongoClient) {
        storeOptions.client = mongoClient;
    } else if (process.env.MONGODB_URI) {
        storeOptions.mongoUrl = process.env.MONGODB_URI;
    } else {
        console.warn('Warning: No Mongo client or MONGODB_URI found for session store. Sessions may fail.');
    }

    app.use(session({
        secret: process.env.SESSION_SECRET || 'keyboard cat',
        resave: false,
        saveUninitialized: true,
        store: MongoStore.create(storeOptions)
    }));

    app.use(express.static('public'));

    app.use(expressLayout);
    app.set('layout', './layouts/main');
    app.set('view engine', 'ejs');

    app.use('/', require('./server/routes/main'));
    app.use('/', require('./server/routes/admin'));

    app.listen(PORT, () => {
        console.log(`App is listening on port ${PORT}`);
    });
}

start().catch(err => {
    console.error('Failed to start app:', err);
    process.exit(1);
});