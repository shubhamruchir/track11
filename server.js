import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// ✅ CORS FIX
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const PORT = process.env.PORT || 10000;

// 🔐 ENV
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SHOP = process.env.SHOP;
const REDIRECT_URI = process.env.REDIRECT_URI;

// ⚠️ Store token (temporary)
let ACCESS_TOKEN = process.env.ACCESS_TOKEN || "";

// ------------------------
// 🚀 AUTH START
// ------------------------
app.get("/auth", (req, res) => {
  if (!CLIENT_ID) return res.send("CLIENT_ID missing in ENV");

  const installUrl = `https://${SHOP}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=read_orders,read_fulfillments&redirect_uri=${REDIRECT_URI}`;

  res.redirect(installUrl);
});

// ------------------------
// 🔁 CALLBACK
// ------------------------
app.get("/auth/callback", async (req, res) => {
  try {
    const { code } = req.query;

    const tokenRes = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code
      })
    });

    const data = await tokenRes.json();

    if (!data.access_token) {
      console.log("ERROR:", data);
      return res.send("OAuth failed");
    }

    ACCESS_TOKEN = data.access_token;

    console.log("ACCESS TOKEN:", ACCESS_TOKEN);

    res.send("SUCCESS: App installed");
  } catch (err) {
    console.error(err);
    res.send("OAuth crash");
  }
});

// ------------------------
// 📦 TRACK ORDER API
// ------------------------
app.post("/track", async (req, res) => {
  try {
    const { email, orderId } = req.body;

    if (!ACCESS_TOKEN) {
      return res.json({ error: "Access token missing" });
    }

    const response = await fetch(
      `https://${SHOP}/admin/api/2023-10/orders.json?status=any`,
      {
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN
        }
      }
    );

    const data = await response.json();

    if (!data.orders) {
      return res.json({ error: "Invalid Shopify response" });
    }

    const order = data.orders.find(
      (o) =>
        o.email === email &&
        (o.name === orderId || o.name === `#${orderId}` || o.order_number == orderId)
    );

    if (!order) {
      return res.json({ error: "Order not found" });
    }

    const fulfillment = order.fulfillments?.[0];

    res.json({
      orderId: order.name,
      status: order.fulfillment_status || "unfulfilled",
      tracking: fulfillment?.tracking_url || "No tracking yet"
    });
  } catch (err) {
    console.error(err);
    res.json({ error: "Server error" });
  }
});

// ------------------------
app.get("/", (req, res) => {
  res.send("Tracking API Running");
});

// ------------------------
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
