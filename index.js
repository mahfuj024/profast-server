// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import admin from "firebase-admin";
import { createRequire } from "module";

dotenv.config();

// 🔹 createRequire for JSON import
const require = createRequire(import.meta.url);
const serviceAccount = require("./firebase-admin-key.json");

// 🔹 Firebase Admin Init
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
const port = process.env.PORT || 4000;
const stripe = new Stripe(process.env.PAYMENT_GATEWAY_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dmc2js1.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// 🔐 Firebase Token Verify Middleware
const verifyFBToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    next();
  } catch (error) {
    return res.status(403).send({ message: "forbidden access" });
  }
};

async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected");

    const db = client.db("parcelDB");
    const usersCollection = db.collection("users");
    const parcelsCollection = db.collection("parcels");
    const paymentsCollection = db.collection("payments");
    const ridersCollection = db.collection("riders");

    // Save user
    app.post("/users", async (req, res) => {
      const { email } = req.body;
      const userExists = await usersCollection.findOne({ email });

      if (userExists) {
        return res.send({ message: "user already exists", inserted: false });
      }

      const result = await usersCollection.insertOne(req.body);
      res.send(result);
    });

    // Get parcels
    app.get("/parcels", verifyFBToken, async (req, res) => {
      const email = req.query.email;

      if (email && req.decoded.email !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = email ? { createdBy: email } : {};
      const parcels = await parcelsCollection
        .find(query)
        .sort({ creation_date: -1 })
        .toArray();

      res.send(parcels);
    });

    // Get parcel by id
    app.get("/parcels/:id", async (req, res) => {
      const parcel = await parcelsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(parcel);
    });

    // Create parcel
    app.post("/parcels", async (req, res) => {
      const result = await parcelsCollection.insertOne(req.body);
      res.send(result);
    });

    // Delete parcel
    app.delete("/parcels/:id", async (req, res) => {
      const result = await parcelsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // Stripe payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { amountInCents } = req.body;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // Save payment & update parcel
    app.post("/payments", async (req, res) => {
      const { parcelId, userEmail, amount, paymentMethod, transactionId } =
        req.body;

      await parcelsCollection.updateOne(
        { _id: new ObjectId(parcelId) },
        {
          $set: {
            payment_status: "paid",
            transactionId,
            paidAt: new Date(),
          },
        }
      );

      const paymentDoc = {
        parcelId: new ObjectId(parcelId),
        userEmail,
        amount,
        paymentMethod,
        transactionId,
        status: "success",
        paid_at: new Date(),
      };

      const paymentResult = await paymentsCollection.insertOne(paymentDoc);

      res.send({
        success: true,
        message: "Payment successful",
        paymentResult,
      });
    });

    // Get payment history
    app.get("/payments", verifyFBToken, async (req, res) => {
      const email = req.query.email;

      if (req.decoded.email !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const payments = await paymentsCollection
        .find({ userEmail: email })
        .sort({ paid_at: -1 })
        .toArray();

      res.send(payments);
    });

    // Create riders
    app.post("/riders", async (req, res) => {
      const rider = req.body
      const result = await ridersCollection.insertOne(rider)
      res.send(result)
    })

    // Get riders
    app.get("/riders", verifyFBToken, async (req, res) => {
      const riders = await ridersCollection.find().toArray();
      res.send(riders);
    });

    // delete rider
    app.delete("/riders/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await ridersCollection.deleteOne(query);

      res.send(result);
    });

    // change status (pending -> active)
    app.patch("/riders/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "active",
        },
      };

      const result = await ridersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

  } catch (error) {
    console.error("❌ Server Error:", error);
  }
}

run();

// Root route
app.get("/", (req, res) => {
  res.send("profast server is running successfully!");
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
