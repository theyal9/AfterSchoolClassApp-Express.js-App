const express = require("express");
const path = require("path");
const cors = require("cors");
const propertiesReader = require("properties-reader");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

let app = express();
app.use(express.json());
app.use(cors());
app.set('json spaces', 3);

// Reading properties
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
        db1 = client.db('lessons');
        // const collections = await db1.listCollections().toArray();
        // console.log('Collections:', collections);
        // app.locals.db = db1;
    } catch (err) {
        console.error('MongoDB connection error:', err);
    }
}

connectDB();

// Middleware to handle collection name
app.param('collectionName', async function(req, res, next, collectionName) {
    // req.collection = req.app.locals.db.collection(collectionName);
    // return next();
    req.collection = db1.collection(collectionName);
    console.log('Middleware set collection:', req.collection.collectionName);
    next();
});

app.get('/collections/:collectionName', async function(req, res, next) {
    try{
        const results = await req.collection.find({}).toArray();
        console.log('Retrieved data:', results);
        res.json(results);
    } catch(err){
        console.error('Error fetching doc', err.message);
        next(err);
    }
});

app.get('/collections1/:collectionName', async function(req, res, next) {
    try{
        const results = await req.collection.find({}, {limit:3, sort: {price:-1}}).toArray();
        console.log('Retrieved data:', results);
        res.json(results);
    } catch(err){
        console.error('Error fetching doc', err.message);
        next(err);
    }
});

app.get('/collections/:collectionName/:max/:sortAspect/:sortAscDesc', async function(req, res, next) {
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
});

app.get('/collections1/:collectionName/:id', async function(req, res, next) {
    try{
        const results = await req.collection.findOne({_id:new ObjectId(req.params.id) });
        console.log('Retrieved data:', results);
        res.json(results);
    } catch(err){
        console.error('Error fetching doc', err.message);
        next(err);
    }    
});

// Endpoint to get all documents in the collection
// app.get('/collections/:collectionName', function(req, res, next) {
//     req.collection.find({}).toArray(function(err, results) {
//         if (err) {
//             return next(err);
//         }
//         res.send(results);
//     });
// });
// app.get('/collections/:collectionName', function(req, res, next) {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 100; // Adjust limit as needed

//     req.collection.find({})
//         .skip((page - 1) * limit)
//         .limit(limit)
//         .toArray(function(err, results) {
//             if (err) {
//                 return next(err);
//             }
//             res.send(results);
//         });
// });


app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
