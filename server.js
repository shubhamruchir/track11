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
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// ✅ TOKEN CACHE SYSTEM
let activeToken = null;
let tokenExpiresAt = null;

async function getAccessToken() {
  // If we have a token and it's not expiring in the next 5 minutes, reuse it
  if (activeToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    return activeToken;
  }

  // Otherwise, ask Shopify for a new token
  const response = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials"
    })
  });

  const data = await response.json();

  if (!data.access_token) {
    console.error("Token Fetch Error:", data);
    throw new Error("Failed to fetch access token from Shopify");
  }

  activeToken = data.access_token;
  // Tokens usually last 24 hours (86400 seconds). We buffer by 5 minutes.
  const expiresInMs = (data.expires_in || 86400) * 1000;
  tokenExpiresAt = Date.now() + expiresInMs - (5 * 60 * 1000);

  return activeToken;
}

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

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.json({ error: "Client credentials missing" });
    }

    // ✅ Get or refresh the token automatically
    let currentToken;
    try {
      currentToken = await getAccessToken();
    } catch (tokenErr) {
      return res.json({ error: "Access token missing or failed to generate" });
    }

    const shopifyRes = await fetch(
      `https://${SHOP}/admin/api/2023-10/orders.json?status=any&limit=50`,
      {
        headers: {
          "X-Shopify-Access-Token": currentToken,
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

    // ✅ Safe fulfillment handling
    const fulfillment =
      order.fulfillments && order.fulfillments.length > 0
        ? order.fulfillments[0]
        : null;

    // ✅ SMART TRACKING NUMBER LOGIC
    let trackingNumber = "Not available";

    if (fulfillment) {
      if (fulfillment.tracking_number) {
        trackingNumber = fulfillment.tracking_number;
      } else if (
        fulfillment.tracking_numbers &&
        fulfillment.tracking_numbers.length > 0
      ) {
        trackingNumber = fulfillment.tracking_numbers[0];
      }
    }

    res.json({
      orderId: order.name,
      status: fulfillment ? "Shipped" : "Processing",
      trackingNumber: trackingNumber,
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
