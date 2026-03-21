const express = require("express");
const fetch = require("node-fetch");
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

// ✅ ENV VARIABLES
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SHOP = "cartigo.shop";

// ⚠️ Store token (for now in memory, better to move to DB later)
let ACCESS_TOKEN = process.env.ACCESS_TOKEN || "";

// =============================
// 🔐 START OAUTH
// =============================
app.get("/auth", (req, res) => {
  if (!CLIENT_ID) {
    return res.send("CLIENT_ID missing in ENV");
  }

  const redirectUri = `https://${req.headers.host}/auth/callback`;

  const installUrl = `https://${SHOP}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=read_orders,read_fulfillments&redirect_uri=${redirectUri}`;

  res.redirect(installUrl);
});

// =============================
// 🔐 CALLBACK (GET TOKEN)
// =============================
app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const response = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
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

    const data = await response.json();

    if (!data.access_token) {
      return res.send("Failed to get access token");
    }

    ACCESS_TOKEN = data.access_token;

    console.log("🔥 ACCESS TOKEN:", ACCESS_TOKEN);

    res.send("App installed successfully. Token generated.");
  } catch (err) {
    console.error(err);
    res.send("OAuth error");
  }
});

// =============================
// 📦 TRACK ORDER API
// =============================
function normalizeOrderId(id) {
  return id.replace("#", "").trim();
}

app.post("/track", async (req, res) => {
  const { email, orderId } = req.body;

  if (!ACCESS_TOKEN) {
    return res.json({ error: "App not authenticated yet" });
  }

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

    if (order.email !== email) {
      return res.json({ error: "Order not found" });
    }

    const fulfillment = order.fulfillments[0];

    res.json({
      orderId: order.name,
      status: order.fulfillment_status || "Processing",
      tracking: fulfillment?.tracking_url || ""
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// =============================
// ROOT CHECK
// =============================
app.get("/", (req, res) => {
  res.send("Tracking API Running");
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
