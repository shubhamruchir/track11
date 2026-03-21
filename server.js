const express = require("express");
const fetch = require("node-fetch");
const app = express();

app.use(express.json());

const SHOP = "yourstore.myshopify.com";
const ACCESS_TOKEN = "your_access_token";

app.post("/track", async (req, res) => {
  const { email, phone } = req.body;

  try {
    const response = await fetch(`https://${SHOP}/admin/api/2024-01/orders.json?status=any`, {
      headers: {
        "X-Shopify-Access-Token": ACCESS_TOKEN,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    const order = data.orders.find(o =>
      o.email === email &&
      o.phone === phone
    );

    if (!order) {
      return res.json({ error: "Order not found" });
    }

    const fulfillment = order.fulfillments[0];

    res.json({
      status: order.fulfillment_status || "Processing",
      tracking: fulfillment?.tracking_url || "Not available"
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(3000, () => console.log("Server running"));
