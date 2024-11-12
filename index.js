const express = require("express");
var http = require("http");
var morgan = require("morgan");
const path = require("path");
const cors = require("cors");
const propertiesReader = require("properties-reader");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

let app = express();

// Middleware
app.use(express.json());  // Parse incoming JSON requests
app.use(cors());  // Enable CORS for all routes
app.use(morgan("short"));  // Log requests

app.set('json spaces', 3);  // Format JSON responses with 3 spaces

// // Logger middleware
// app.use((req, res, next) => {
//     console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
//     next();
// });

// Serve static files from the Vue app
app.use(express.static(path.join(__dirname, '../AfterSchoolClass-AppVue.js-App')));

// Serve the index.html file on the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../AfterSchoolClass-AppVue.js-App/index.html'));
});

// Reading properties for database connection
let propertiesPath = path.resolve(__dirname, "./dbconnection.properties");
let properties = propertiesReader(propertiesPath);

let dbPrefix = properties.get("db.prefix");
let dbHost = properties.get("db.host");
let dbName = properties.get("db.name");
let dbUser = properties.get("db.user");
let dbPassword = properties.get("db.password");
let dbParams = properties.get("db.params");

// MongoDB connection URL
const uri = `${dbPrefix}${dbUser}:${dbPassword}${dbHost}${dbParams}`;
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });
let db1;

async function connectDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        db1 = client.db('AfterSchoolClassApp');
    } catch (err) {
        console.error('MongoDB connection error:', err);
    }
}

connectDB();

// Middleware to handle collection name dynamically
app.param('collectionName', async function(req, res, next, collectionName) {
    if (!db1) {
        return res.status(500).json({ error: 'Database not connected' });
    }
    req.collection = db1.collection(collectionName);
    console.log('Middleware set collection:', req.collection.collectionName);
    next();
});

// // Fetch all documents from a collection
// app.get('/:collectionName', async function(req, res, next) {
//     try{
//         const results = await req.collection.find({}).toArray();
//         console.log('Retrieved data:', results);
//         res.json(results);
//     } catch(err){
//         console.error('Error fetching doc', err.message);
//         next(err);
//     }
// });

// Fetch all documents from lesson collection
app.get('/:lessons', async function(req, res, next) {
    try{
        const results = await db1.collection('lesson').find({}).toArray();
        console.log('Retrieved data:', results);
        res.json(results);
    } catch(err){
        console.error('Error fetching doc', err.message);
        next(err);
    }
});

// Fetch limited sorted documents from a collection
app.get('/:collectionName/:max/:sortAspect/:sortAscDesc', async function(req, res, next) {
    try{
        var max = parseInt(req.params.max, 100);
        let sortDirection = 1;
        if (req.params.sortAscDesc === "desc"){
            sortDirection = -1;
        }
        const results = await req.collection.find({}, {limit:max, sort: {[req.params.sortAspect]: sortDirection}}).toArray();
        console.log('Retrieved data:', results);
        res.json(results);
    } catch(err){
        console.error('Error fetching doc', err.message);
        next(err);
    }
});

// PUT request to update spaces for a lesson in a collection
app.put('/lesson/:id', async function(req, res, next) {
    const lessonId = parseInt(req.params.id, 10);  // The ID of the lesson to update
    const { spaces } = req.body;

    try {
        if (typeof spaces !== 'number') {
            return res.status(400).json({ error: 'Invalid spaces value.' });
        }

        // Log the incoming request details for debugging
        console.log('Updating lesson spaces:', { lessonId, spaces });

        // Update the spaces field based on spaces (+1 or -1)
        const updateResponse = await db1.collection('lesson').updateOne(
            { id: lessonId },  // Find the lesson by ID
            { $set: { spaces: spaces } }  // $set to update the spaces field
        );

        if (updateResponse.modifiedCount === 0) {
            return res.status(404).json({ error: 'Lesson not found or no changes made' });
        }

        // Return the updated lesson document
        const updatedLesson = await db1.collection('lesson').findOne({ id: lessonId });
        res.json(updatedLesson);

    } catch (error) {
        console.error('Error updating lesson spaces:', error);
        res.status(500).json({ error: 'Error updating lesson spaces' });
    }
});

app.post('/addOrder', async function(req, res, next) {
    try {
        const order = req.body;

        // Validate required fields
        if (!order.firstName || !order.lastName || !order.address || !order.city || !order.zip ||
            !order.state || !order.phoneNumber || !order.method || !order.lessonIDs || !Array.isArray(order.lessonIDs)) {
            return res.status(400).json({ error: 'Missing or invalid required fields' });
        }

        const count = await db1.collection('order').countDocuments();

        // Prepare the order data to save
        const orderData = {
            id: count + 1 + order.zip,
            firstName: order.firstName,
            lastName: order.lastName,
            address: order.address,
            city: order.city,
            zip: order.zip,
            state: order.state,
            phoneNumber: order.phoneNumber,
            method: order.method,
            sendGift: order.sendGift,
            lessonIDs: order.lessonIDs
        };

        // Insert order data into the MongoDB collection
        const result = await db1.collection('order').insertOne(orderData);

        res.status(201).json({ message: 'Order saved successfully', orderId: result.insertedId });
    
    } catch (error) {
        console.error("Error saving order:", error);
        res.status(500).json({ message: 'Failed to save order' });
    }
});

// Handle missing image files (custom error message)
app.use('/images', (req, res, next) => {
    res.status(404).json({ error: "Image file not found" });
});

// Handle missing routes with a custom error message
app.use((req, res, next) => {
    res.status(404).send("File not found!");
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});