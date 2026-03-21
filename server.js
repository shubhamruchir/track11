import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// ✅ CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const PORT = process.env.PORT || 10000;

// ENV
const SHOP = process.env.SHOP;
let ACCESS_TOKEN = process.env.ACCESS_TOKEN || "";

// ------------------------
// TRACK ORDER API
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

    const shopifyRes = await fetch(
      `https://${SHOP}/admin/api/2023-10/orders.json?status=any&limit=50`,
      {
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await shopifyRes.json();

    if (!data.orders) {
      return res.json({ error: "No orders found" });
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

    // ✅ SAFE fulfillment handling
    const fulfillment =
      order.fulfillments && order.fulfillments.length > 0
        ? order.fulfillments[0]
        : null;

    res.json({
      orderId: order.name,
      status: fulfillment ? "Shipped" : "Processing",
      trackingNumber: fulfillment?.tracking_number || "Not generated yet",
      courier: fulfillment?.tracking_company || "Not assigned",
      estimatedDelivery: fulfillment
        ? "3-5 Days"
        : "Will be updated after dispatch",
    });
  } catch (err) {
    console.error("ERROR:", err);
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
