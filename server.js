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

// ENV VARIABLES
const SHOP = process.env.SHOP;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// ✅ TOKEN CACHE SYSTEM
let activeToken = null;
let tokenExpiresAt = null;

async function getAccessToken() {
  if (activeToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    return activeToken;
  }

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
  const expiresInMs = (data.expires_in || 86400) * 1000;
  tokenExpiresAt = Date.now() + expiresInMs - (5 * 60 * 1000);

  return activeToken;
}

// ✅ SUPER COURIER DETECTOR
function getCourierLink(courier, trackingNumber) {
  if (!trackingNumber || trackingNumber === "Not available") return null;

  const c = (courier || "").toLowerCase();

  if (c.includes("delhivery")) return `https://www.delhivery.com/track/package/${trackingNumber}`; 
  if (c.includes("ekart")) return `https://ekartlogistics.com/shipmenttrack/${trackingNumber}`;
  if (c.includes("amazon") || c.includes("swiship")) return `https://www.swiship.in/track?id=${trackingNumber}`;
  if (c.includes("bluedart") || c.includes("blue dart")) return `https://www.bluedart.com/tracking?track=${trackingNumber}`;
  if (c.includes("ecom") || c.includes("ecom express")) return `https://ecomexpress.in/tracking/?awb_field=${trackingNumber}`;
  if (c.includes("xpressbees")) return `https://www.xpressbees.com/track?awb=${trackingNumber}`;
  if (c.includes("shadowfax")) return `https://tracker.shadowfax.in/track?order=true&awb=${trackingNumber}`;
  if (c.includes("dtdc")) return `https://track.dtdc.in/ctbs-tracking/customerInterface.tr?wAction=infodeskTrack&trackType=AWB&strKeys=${trackingNumber}`;
  if (c.includes("shiprocket")) return `https://www.shiprocket.in/shipment-tracking/?awb=${trackingNumber}`;

  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
  if (c.includes("dhl")) return `https://www.dhl.com/in-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`;
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  
  return `https://parcelsapp.com/en/tracking/${trackingNumber}`;
}

// ------------------------
// TRACK ORDER API
// ------------------------
app.post("/track", async (req, res) => {
  try {
    const { email, orderId } = req.body;

    if (!email || !orderId) return res.json({ error: "Missing email or orderId" });
    if (!SHOP || !CLIENT_ID || !CLIENT_SECRET) return res.json({ error: "API credentials missing" });

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
    if (!data.orders) return res.json({ error: "No orders found" });

    const cleanId = orderId.replace("#", "").trim();
    const order = data.orders.find((o) => {
      return (
        o.email.toLowerCase() === email.toLowerCase() &&
        (o.name === orderId || o.name === `#${cleanId}` || o.order_number == cleanId)
      );
    });

    if (!order) return res.json({ error: "Order not found" });

    const fulfillment = order.fulfillments && order.fulfillments.length > 0 ? order.fulfillments[0] : null;

    let trackingNumber = "Not available";
    if (fulfillment) {
      if (fulfillment.tracking_number) trackingNumber = fulfillment.tracking_number;
      else if (fulfillment.tracking_numbers && fulfillment.tracking_numbers.length > 0) {
        trackingNumber = fulfillment.tracking_numbers[0];
      }
    }

    const courierName = fulfillment?.tracking_company || "Not assigned";
    const trackingUrl = getCourierLink(courierName, trackingNumber);

    // ✅ READ REAL SHIPMENT STATUS & DEFAULT TO "IN TRANSIT"
    let shipmentStatus = "Processing";
    if (fulfillment) {
      shipmentStatus = "in_transit"; // <-- Defaults to In Transit here!
      if (fulfillment.shipment_status) {
        shipmentStatus = fulfillment.shipment_status; 
      }
    }

    // ✅ UPGRADED ESTIMATED DELIVERY (Creates a professional Date Range)
    let estimatedDeliveryDate = "Updating...";
    
    if (fulfillment && fulfillment.estimated_delivery_at) {
      const d = new Date(fulfillment.estimated_delivery_at);
      estimatedDeliveryDate = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } else if (fulfillment && fulfillment.created_at) {
      const d1 = new Date(fulfillment.created_at);
      d1.setDate(d1.getDate() + 4); 
      const d2 = new Date(fulfillment.created_at);
      d2.setDate(d2.getDate() + 7); 
      estimatedDeliveryDate = `${d1.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${d2.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (order && order.created_at) {
      const d1 = new Date(order.created_at);
      d1.setDate(d1.getDate() + 5); 
      const d2 = new Date(order.created_at);
      d2.setDate(d2.getDate() + 9); 
      estimatedDeliveryDate = `${d1.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${d2.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    res.json({
      orderId: order.name,
      status: shipmentStatus,
      trackingNumber: trackingNumber,
      courier: courierName,
      trackingUrl: trackingUrl, 
      estimatedDelivery: estimatedDeliveryDate, 
    });
  } catch (err) {
    console.error("ERROR:", err);
    res.json({ error: "Server error" });
  }
});

app.get("/", (req, res) => res.send("Tracking API Running"));
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
