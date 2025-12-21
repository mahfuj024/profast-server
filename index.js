// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';


// Load environment variables from .env
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());


// mongodb code
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dmc2js1.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("parcelDB");
    const parcelsCollection = db.collection("parcels");

    //get all parcels OR get parcel by userEmail (created_by), sort by latest
    app.get("/parcels", async (req, res) => {
      try {
        const userEmail = req.query.email;
        const query = userEmail ? { createdBy: userEmail } : {};

        const parcels = await parcelsCollection
          .find(query)
          .sort({ createdAt: -1 }) // লেটেস্ট ডাটা আগে আসবে
          .toArray();

        res.send(parcels);
      } catch (error) {
        console.error("Error fetching parcels: ", error);
        res.status(500).send({ message: "Failed to get parcels" });
      }
    });

    // save parcels in database
    app.post("/parcels", async (req, res) => {
      const parcelsData = req.body
      const result = await parcelsCollection.insertOne(parcelsData)
      res.send(result)
    })

    // delete parcel by ID
    app.delete('/parcels/:id', async (req, res) => {
      try {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };
        const result = await parcelsCollection.deleteOne(query);

        res.send(result)
      } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



// Example route
app.get("/", (req, res) => {
  res.send("profast server is running successfully!");
});

// Start server
app.listen(port, () => {
  console.log(`🚀 profast server running on port: ${port}`);
});
