// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dmc2js1.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected");

    const db = client.db("parcelDB");
    const parcelsCollection = db.collection("parcels");

    // get all parcels OR by email
    app.get("/parcels", async (req, res) => {
      try {
        const userEmail = req.query.email;
        const query = userEmail ? { createdBy: userEmail } : {};

        const parcels = await parcelsCollection
          .find(query)
          .sort({ creation_date: -1 }) // ✔ correct field
          .toArray();

        res.send(parcels);
      } catch (error) {
        res.status(500).send({ message: "Failed to get parcels" });
      }
    });

    // get parcel by id
    app.get("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const parcel = await parcelsCollection.findOne({
        _id: new ObjectId(id)
      });
      res.send(parcel);
    });

    // create parcel
    app.post("/parcels", async (req, res) => {
      const result = await parcelsCollection.insertOne(req.body);
      res.send(result);
    });

    // delete parcel
    app.delete("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const result = await parcelsCollection.deleteOne({
        _id: new ObjectId(id)
      });
      res.send(result);
    });

  } catch (error) {
    console.error("❌ Server Error:", error);
  }
}

// root route
app.get("/", (req, res) => {
  res.send("profast server is running successfully!");
});

// start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

run().catch(console.dir);
