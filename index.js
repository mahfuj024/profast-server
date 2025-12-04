// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());


// Example route
app.get("/", (req, res) => {
  res.send("profast server is running successfully!");
});

// Start server
app.listen(port, () => {
  console.log(`🚀 profast server running on port: ${port}`);
});
