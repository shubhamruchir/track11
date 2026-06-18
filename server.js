import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

const PORT = process.env.PORT || 10000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SHOP = process.env.SHOP;

// Temporary storage
let ACCESS_TOKEN = "";

/*
=================================
HOME
=================================
*/

app.get("/", (req, res) => {
  res.send("Tracking API Running");
});

/*
=================================
INSTALL APP
=================================
*/

app.get("/auth", (req, res) => {

  const installUrl =
    `https://${SHOP}/admin/oauth/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&scope=read_orders,read_fulfillments` +
    `&redirect_uri=https://track11-13eq.onrender.com/auth/callback`;

  res.redirect(installUrl);
});

/*
=================================
CALLBACK
=================================
*/

app.get("/auth/callback", async (req, res) => {

  try {

    const { code } = req.query;

    if (!code) {
      return res.send("Missing code");
    }

    const tokenResponse = await fetch(
      `https://${SHOP}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code
        })
      }
    );

    const tokenData = await tokenResponse.json();

    console.log("TOKEN DATA:", tokenData);

    ACCESS_TOKEN = tokenData.access_token;

    if (!ACCESS_TOKEN) {
      return res.send("Access token not received");
    }

    res.send("SUCCESS: App installed");

  } catch (err) {

    console.error(err);
    res.send("OAuth Error");

  }

});

/*
=================================
TEST ORDERS
=================================
*/

app.get("/test-orders", async (req, res) => {

  try {

    if (!ACCESS_TOKEN) {
      return res.json({
        error: "Access token missing"
      });
    }

    const response = await fetch(
      `https://${SHOP}/admin/api/2023-10/orders.json?status=any&limit=20`,
      {
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN
        }
      }
    );

    const data = await response.json();

    res.json(data);

  } catch (err) {

    res.json({
      error: err.message
    });

  }

});

/*
=================================
TRACK ORDER
=================================
*/

app.post("/track", async (req, res) => {

  try {

    const { email, orderId } = req.body;

    if (!email || !orderId) {
      return res.json({
        error: "Missing email or orderId"
      });
    }

    if (!ACCESS_TOKEN) {
      return res.json({
        error: "Access token missing"
      });
    }

    const response = await fetch(
      `https://${SHOP}/admin/api/2023-10/orders.json?status=any&limit=250`,
      {
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN
        }
      }
    );

    const data = await response.json();

    const cleanOrderId = orderId.replace("#", "").trim();

    const order = data.orders.find(o =>
      o.email?.toLowerCase() === email.toLowerCase() &&
      (
        o.name === orderId ||
        o.name === `#${cleanOrderId}` ||
        o.order_number == cleanOrderId
      )
    );

    if (!order) {
      return res.json({
        error: "No orders found"
      });
    }

    const fulfillment =
      order.fulfillments &&
      order.fulfillments.length > 0
        ? order.fulfillments[0]
        : null;

    let trackingNumber = "Not available";

    if (fulfillment) {

      if (fulfillment.tracking_number) {
        trackingNumber = fulfillment.tracking_number;
      }

      else if (
        fulfillment.tracking_numbers &&
        fulfillment.tracking_numbers.length > 0
      ) {
        trackingNumber = fulfillment.tracking_numbers[0];
      }

    }

    res.json({
      orderId: order.name,
      status: fulfillment ? "Shipped" : "Processing",
      trackingNumber,
      courier: fulfillment?.tracking_company || "Not assigned",
      estimatedDelivery: fulfillment
        ? "3-5 Days"
        : "Will be updated after dispatch"
    });

  } catch (err) {

    console.error(err);

    res.json({
      error: err.message
    });

  }

});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
