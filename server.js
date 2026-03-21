import express from "express";
import fetch from "node-fetch";
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

// 🔐 ENV VARIABLES
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SHOP = process.env.SHOP; // MUST be correct
const REDIRECT_URI = process.env.REDIRECT_URI;
let ACCESS_TOKEN = process.env.ACCESS_TOKEN || "";

// 🔍 DEBUG (IMPORTANT)
console.log("CLIENT_ID:", CLIENT_ID);
console.log("SHOP:", SHOP);
console.log("ACCESS_TOKEN:", ACCESS_TOKEN ? "Loaded" : "Missing");

// ------------------------
// 🚀 AUTH
// ------------------------
app.get("/auth", (req, res) => {
  if (!CLIENT_ID || !SHOP) {
    return res.send("Missing CLIENT_ID or SHOP in ENV");
  }

  const installUrl = `https://${SHOP}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=read_orders,read_fulfillments&redirect_uri=${REDIRECT_URI}`;

  res.redirect(installUrl);
});

// ------------------------
// 🔁 CALLBACK
// ------------------------
app.get("/auth/callback", async (req, res) => {
  try {
    const { code } = req.query;

    const response = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }),
    });

    const data = await response.json();

    if (!data.access_token) {
      console.log("OAuth error:", data);
      return res.send("OAuth failed");
    }

    ACCESS_TOKEN = data.access_token;

    console.log("🔥 NEW ACCESS TOKEN:", ACCESS_TOKEN);

    res.send("SUCCESS: App installed");
  } catch (err) {
    console.error("OAuth crash:", err);
    res.send("OAuth crash");
  }
});

// ------------------------
// 📦 TRACK ORDER
// ------------------------
app.post("/track", async (req, res) => {
  try {
    const { email, orderId } = req.body;

    if (!email || !orderId) {
      return res.json({ error: "Missing email or orderId" });
    }

    if (!SHOP) {
      return res.json({ error: "SHOP not configured" });
    }

    if (!ACCESS_TOKEN) {
      return res.json({ error: "Access token missing" });
    }

    console.log("➡️ Request:", email, orderId);

    const shopifyRes = await fetch(
      `https://${SHOP}/admin/api/2023-10/orders.json?status=any&limit=50`,
      {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const raw = await shopifyRes.text();
    console.log("🧾 RAW SHOPIFY:", raw);

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return res.json({ error: "Invalid JSON from Shopify" });
    }

    if (!data.orders) {
      return res.json({ error: "No orders returned from Shopify" });
    }

    const cleanId = orderId.replace("#", "").trim();

    const order = data.orders.find((o) => {
      return (
        o.email === email &&
        (o.name === orderId ||
          o.name === `#${cleanId}` ||
          o.order_number == cleanId)
      );
    });

    if (!order) {
      return res.json({ error: "Order not found" });
    }

    const fulfillment = order.fulfillments?.[0];

    res.json({
      orderId: order.name,
      status: order.fulfillment_status || "unfulfilled",
      tracking: fulfillment?.tracking_url || "No tracking available",
    });
  } catch (err) {
    console.error("🔥 TRACK ERROR:", err);
    res.json({ error: err.message });
  }
});

// ------------------------
app.get("/", (req, res) => {
  res.send("Tracking API Running");
});

// ------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
