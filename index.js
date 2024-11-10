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

// Fetch all documents from a collection
app.get('/:collectionName', async function(req, res, next) {
    try{
        const results = await req.collection.find({}).toArray();
        console.log('Retrieved data:', results);
        res.json(results);
    } catch(err){
        console.error('Error fetching doc', err.message);
        next(err);
    }
});

// // API Route for another collection with sorting and limiting
// app.get('/:collectionName', async function(req, res, next) {
//     try{
//         const results = await req.collection.find({}, {limit:3, sort: {price:-1}}).toArray();
//         console.log('Retrieved data:', results);
//         res.json(results);
//     } catch(err){
//         console.error('Error fetching doc', err.message);
//         next(err);
//     }
// });

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
    // const max = parseInt(req.params.max, 10);
    // const sortDirection = req.params.sortAscDesc === "desc" ? -1 : 1;
    // const results = await req.collection.find({})
    //     .limit(max)
    //     .sort({ [req.params.sortAspect]: sortDirection })
    //     .toArray();
    // res.json(results);
});

// Fetch a single document by ID from a collection
app.get('/:collectionName/:id', async function(req, res, next) {
    try{
        const results = await req.collection.findOne({id: req.params.id });
        console.log('Retrieved data:', results);
        res.json(results);
    } catch(err){
        console.error('Error fetching doc', err.message);
        next(err);
    }    
});

// Get the total number of documents in a collection
app.get('/:collectionName/count/:id', async function(req, res, next) {
    try {
        const { id } = req.params.id; 
        const collection = req.app.locals.db.collection(req.params.collectionName);  // Get collection

        if (id != undefined) {
            // Find document by lessonID
            const document = await collection.findOne({ lessonID: parseInt(id) });

            if (document && document.quantity !== undefined) {
                // Return the quantity field
                res.json({ quantity: document.quantity });
            } else {
                // Return 0 if no document or quantity field is found
                res.json({ quantity: 0 });
            }
        } else {
            // If no id provided, return document count
            const count = await collection.countDocuments();
            res.json({ count });
        }
    } catch (err) {
        console.error('Error fetching count', err.message);
        res.status(500).json({ error: 'Error counting documents' });
        next(err);
    }
});

app.post('/addOrder', async function(req, res, next) {
    try {
        const order = req.body;

        if (!order.lessonID) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if the order with the specified lessonID already exists
        const existingOrder = await db1.collection('order').findOne({ lessonID: order.lessonID });

        if (existingOrder) {
            // If it exists, increment the quantity by 1
            const result = await db1.collection('order').updateOne(
                { lessonID: order.lessonID },
                { $inc: { quantity: 1 } }
            );
            console.log('Updated existing order, increased quantity:', result);
            res.status(200).json({ message: 'Order quantity updated', result });
        } else {
            // If it does not exist, insert a new document with quantity set to 1
            const newOrder = { ...order, quantity: 1 };
            const result = await db1.collection('order').insertOne(newOrder);
            console.log('Created new order! Lesson added to cart:', result);
            res.status(201).json({ message: 'New order created', result });
        }

    } catch (err) {
        console.error('Error inserting or updating order:', err.message);
        res.status(500).json({ error: `Error creating or updating order: ${err.message}` });
    }
});

// PUT request to update spaces for a lesson in a collection
app.put('/lesson/:id', async function(req, res, next) {
    const lessonId = parseInt(req.params.id, 10);  // The ID of the lesson to update
    const { spaces } = req.body;  // The space change (either +1 or -1)

    try {
        if (typeof spaces !== 'number' || (spaces !== 1 && spaces !== -1)) {
            return res.status(400).json({ error: 'Invalid spaces value.' });
        }

        // Log the incoming request details for debugging
        console.log('Updating lesson spaces:', { lessonId, spaces });

        // Update the spaces field based on spaces (+1 or -1)
        const updateResponse = await db1.collection('lesson').updateOne(
            { id: lessonId },  // Find the lesson by ID
            { $inc: { spaces: spaces } }  // Increment or decrement spaces
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

// http.createServer(app).listen(3000); // start the server