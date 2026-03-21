const express = require("express");
const fetch = require("node-fetch");
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

// Environment variables (SET THESE IN RENDER)
const SHOP = process.env.SHOP; 
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

// Normalize order ID (remove # if user enters it)
function normalizeOrderId(id) {
  return id.replace("#", "").trim();
}

app.post("/track", async (req, res) => {
  const { email, orderId } = req.body;

  try {
    const cleanOrderId = normalizeOrderId(orderId);

    const response = await fetch(
      `https://${SHOP}/admin/api/2024-01/orders.json?name=${cleanOrderId}&status=any`,
      {
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await response.json();

    if (!data.orders || data.orders.length === 0) {
      return res.json({ error: "Order not found" });
    }

    const order = data.orders[0];

    // Validate email
    if (order.email !== email) {
      return res.json({ error: "Order not found" });
    }

    const fulfillment = order.fulfillments[0];

    res.json({
      orderId: order.name,
      status: order.fulfillment_status || "Processing",
      tracking: fulfillment?.tracking_url || "",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/", (req, res) => {
  res.send("Tracking API Running");
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
