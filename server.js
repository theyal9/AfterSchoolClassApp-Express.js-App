// Import necessary modules
const express = require("express");
var http = require("http");
var morgan = require("morgan");
const path = require("path");
const cors = require("cors");
const propertiesReader = require("properties-reader");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Create an Express application
let app = express();

// Middleware
app.use(express.json());  // Parse incoming JSON requests
app.use(cors());  // Enable CORS for all routes
app.use(morgan("short"));  // Log requests in a short format

// Set JSON response formatting with 3 spaces for readability
app.set('json spaces', 3);

// Serve static files from the Vue app directory
app.use(express.static(path.join(__dirname, '../AfterSchoolClass-AppVue.js-App')));

// Serve the index.html file on the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../AfterSchoolClass-AppVue.js-App/index.html'));
});

// Reading properties for database connection from a properties file
let propertiesPath = path.resolve(__dirname, "./dbconnection.properties");
let properties = propertiesReader(propertiesPath);

// Extract database connection parameters from properties
let dbPrefix = properties.get("db.prefix");
let dbHost = properties.get("db.host");
let dbName = properties.get("db.name");
let dbUser  = properties.get("db.user");
let dbPassword = properties.get("db.password");
let dbParams = properties.get("db.params");

// Construct MongoDB connection URL
const uri = `${dbPrefix}${dbUser }:${dbPassword}${dbHost}${dbParams}`;
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });
let db1;  // Variable to hold the database connection

// Function to connect to the MongoDB database
async function connectDB() {
    try {
        await client.connect();  // Attempt to connect to the database
        console.log('Connected to MongoDB');
        db1 = client.db('AfterSchoolClassApp');  // Specify the database to use
    } catch (err) {
        console.error('MongoDB connection error:', err);  // Log any connection errors
    }
}

// Call the connectDB function to establish the connection
connectDB();

// Middleware to handle dynamic collection names in route parameters
app.param('collectionName', async function(req, res, next, collectionName) {
    if (!db1) {
        return res.status(500).json({ error: 'Database not connected' });  // Check if DB is connected
    }
    req.collection = db1.collection(collectionName);  // Set the requested collection on the request object
    console.log('Middleware set collection:', req.collection.collectionName);
    next();  // Proceed to the next middleware or route handler
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

// Fetch all documents from the 'lesson' collection
app.get('/lessons', async function(req, res, next) {
    try {
        const results = await db1.collection('lesson').find({}).toArray();  // Retrieve all lessons
        console.log('Retrieved data:', results);  // Log the retrieved data
        res.json(results);  // Send the results as a JSON response
    } catch (err) {
        console.error('Error fetching doc', err.message);  // Log any errors
        next(err);  // Pass the error to the next middleware
    }
});

// Fetch limited sorted documents from a dynamic collection
app.get('/:collectionName/:max/:sortAspect/:sortAscDesc', async function(req, res, next) {
    try {
        var max = parseInt(req.params.max, 10);  // Parse max limit from route parameters
        let sortDirection = req.params.sortAscDesc === "desc" ? -1 : 1;  // Determine sort direction

        // Find documents with limit and sorting
        const results = await req.collection.find({})
            .limit(max)
            .sort({ [req.params.sortAspect]: sortDirection })
            .toArray();
        
        console.log('Retrieved data:', results);  // Log the retrieved data
        res.json(results);  // Send the results as a JSON response
    } catch (err) {
        console.error('Error fetching doc', err.message);  // Log any errors
        next(err);  // Pass the error to the next middleware
    }
});

// PUT request to update spaces for a lesson by ID
app.put('/lesson/:id', async function(req, res, next) {
    const lessonId = parseInt(req.params.id, 10);  // Parse lesson ID from route parameters
    const { spaces } = req.body;  // Get spaces from request body

    try {
        // Validate spaces value
        if (typeof spaces !== 'number') {
            return res.status(400).json({ error: 'Invalid spaces value.' }); }

        // Log the incoming request details for debugging
        console.log('Updating lesson spaces:', { lessonId, spaces });

        // Update the spaces field based on the provided value
        const updateResponse = await db1.collection('lesson').updateOne(
            { id: lessonId },  // Find the lesson by ID
            { $set: { spaces: spaces } }  // Update the spaces field
        );

        // Check if the update was successful
        if (updateResponse.modifiedCount === 0) {
            return res.status(404).json({ error: 'Lesson not found or no changes made' });
        }

        // Return the updated lesson document
        const updatedLesson = await db1.collection('lesson').findOne({ id: lessonId });
        res.json(updatedLesson);  // Send the updated lesson as a JSON response

    } catch (error) {
        console.error('Error updating lesson spaces:', error);  // Log any errors
        res.status(500).json({ error: 'Error updating lesson spaces' });  // Send error response
    }
});

// POST request to add a new order
app.post('/addOrder', async function(req, res, next) {
    try {
        const order = req.body;  // Get order data from request body

        // Validate required fields
        if (!order.firstName || !order.lastName || !order.address || !order.city || !order.zip ||
            !order.state || !order.phoneNumber || !order.method || !order.lessonIDs || !Array.isArray(order.lessonIDs)) {
            return res.status(400).json({ error: 'Missing or invalid required fields' });
        }

        // Prepare the order data to save
        const orderData = {
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

        res.status(201).json({ message: 'Order saved successfully', orderId: result.insertedId });  // Send success response
    
    } catch (error) {
        console.error("Error saving order:", error);  // Log any errors
        res.status(500).json({ message: 'Failed to save order' });  // Send error response
    }
});

// Full-text search route for lessons
app.get('/search/:query', async function (req, res, next) {
    const searchTerm = req.params.query;  // Get the search term from route parameters
    const isNumeric = /^\d+(\.\d+)?$/.test(searchTerm);  // Check if search term is a number

    // Build the query with regex for text fields
    const query = {
        $or: [
            { subject: { $regex: searchTerm, $options: 'i' } },
            { location: { $regex: searchTerm, $options: 'i' } }
        ]
    };

    // Add price search if search term is numeric
    if (isNumeric) {
        const numericValue = parseFloat(searchTerm);
        query.$or.push({ price: numericValue });
        query.$or.push({ spaces: numericValue });
    }
    
    try {
        const results = await db1.collection('lesson').find(query).toArray();  // Execute the search query
        res.json(results);  // Return matched lessons as a JSON response
    } catch (err) {
        console.error('Error performing search:', err);  // Log any errors
        res.status(500).json({ error: 'Error performing search' });  // Send error response
    }
});

// Handle missing image files with a custom error message
app.use('/images', (req, res, next) => {
    res.status(404).json({ error: "Image file not found" });  // Send 404 error for missing images
});

// Handle missing routes with a custom error message
app.use((req, res, next) => {
    res.status(404).send("File not found!");  // Send 404 error for missing routes
});

// Start the server and listen on port 3000
const port = process.env.PORT || 3000;
app.listen(port, function() {
    console.log("App started on port: " + port);
});