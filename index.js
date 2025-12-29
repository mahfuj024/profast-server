// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const stripe = new Stripe(process.env.PAYMENT_GATEWAY_KEY)

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

    const db = client.db("parcelDB"); //database name
    const parcelsCollection = db.collection("parcels"); // database collection
    const paymentsCollection = db.collection("payments"); //database collection

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

    // internasnal payment gateway (stripe) related api 
    app.post('/create-payment-intent', async (req, res) => {
      const amountInCents = req.body.amountInCents
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents, // Amount in cents
          currency: 'usd',
          payment_method_types: ['card'],
        });

        res.json({ clientSecret: paymentIntent.client_secret })
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    })

    // Stripe related api --> Update parcel payment status , Save payment history
    app.post("/payments", async (req, res) => {
      try {
        const { parcelId, userEmail, amount, paymentMethod, transactionId } = req.body;

        // 1️⃣ Update parcel payment status
        const parcelUpdateResult = await parcelsCollection.updateOne(
          { _id: new ObjectId(parcelId) },
          {
            $set: {
              payment_status: "paid",
              transactionId,
              paidAt: new Date()
            }
          }
        );

        // 2️⃣ Save payment history
        const paymentDoc = {
          parcelId: new ObjectId(parcelId),
          userEmail,
          amount,
          paymentMethod,
          transactionId,
          status: "success",
          paid_at_string: new Date().toISOString(),
          paid_at: new Date()
        };

        const paymentResult = await paymentsCollection.insertOne(paymentDoc);

        res.send({
          success: true,
          message: "Payment successful",
          parcelUpdateResult,
          paymentResult
        });

      } catch (error) {
        console.error("Payment Error:", error);
        res.status(500).send({ success: false, message: "Payment failed" });
      }
    });

    // Stripe related api --> Get Payment History by User
    app.get("/payments", async (req, res) => {
      try {
        const email = req.query.email;
        const query = email ? { userEmail: email } : {};

        const payments = await paymentsCollection
          .find(query)
          .sort({ paid_at: -1 }) // ✅ latest first
          .toArray();

        res.send(payments);
      } catch (error) {
        res.status(500).send({ message: "Failed to load payments" });
      }
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
