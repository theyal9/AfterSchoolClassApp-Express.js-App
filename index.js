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

// API Route for another collection with sorting and limiting
app.get('/:collectionName', async function(req, res, next) {
    try{
        const results = await req.collection.find({}, {limit:3, sort: {price:-1}}).toArray();
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
        var max = parseInt(req.params.max, 0);
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
        const results = await req.collection.findOne({_id:new ObjectId(req.params.id) });
        console.log('Retrieved data:', results);
        res.json(results);
    } catch(err){
        console.error('Error fetching doc', err.message);
        next(err);
    }    
});

app.post('/:collectionName', async function(req, res, next) {
    try {
        const order = req.body;  // Get the order data sent from the client
        if (!order.lessonID) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Insert the order into the 'order' collection
        const result = await db1.collection('order').insertOne(order);
        console.log('Created new order! Lesson added to cart:', result);
        res.status(201).json(result);  // Send back the inserted order details
    } catch (err) {
        console.error('Error inserting order:', err.message);
        res.status(500).json({ error: 'Error creating order' });
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