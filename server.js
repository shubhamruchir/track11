import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const PORT = process.env.PORT || 10000;

// ENV VARIABLES
const SHOP = process.env.SHOP;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

// ------------------------
// COURIER TRACKING LINKS
// ------------------------
function getCourierLink(courier, trackingNumber) {
  if (!trackingNumber || trackingNumber === "Not available") {
    return null;
  }

  const c = (courier || "").toLowerCase();

  if (c.includes("delhivery")) {
    return `https://www.delhivery.com/track/package/${trackingNumber}`;
  }

  if (c.includes("ekart")) {
    return `https://ekartlogistics.com/shipmenttrack/${trackingNumber}`;
  }

  if (c.includes("amazon") || c.includes("swiship")) {
    return `https://www.swiship.in/track?id=${trackingNumber}`;
  }

  if (c.includes("bluedart")) {
    return `https://www.bluedart.com/tracking?track=${trackingNumber}`;
  }

  if (c.includes("ecom")) {
    return `https://ecomexpress.in/tracking/?awb_field=${trackingNumber}`;
  }

  if (c.includes("xpressbees")) {
    return `https://www.xpressbees.com/track?awb=${trackingNumber}`;
  }

  if (c.includes("shadowfax")) {
    return `https://tracker.shadowfax.in/track?awb=${trackingNumber}`;
  }

  if (c.includes("dtdc")) {
    return `https://track.dtdc.in/ctbs-tracking/customerInterface.tr?wAction=infodeskTrack&trackType=AWB&strKeys=${trackingNumber}`;
  }

  return `https://parcelsapp.com/en/tracking/${trackingNumber}`;
}

// ------------------------
// TRACK ORDER API
// ------------------------
app.post("/track", async (req, res) => {
  try {
    const { email, orderId } = req.body;

    if (!email || !orderId) {
      return res.json({
        error: "Missing email or orderId"
      });
    }

    if (!SHOP || !ACCESS_TOKEN) {
      return res.json({
        error: "Shopify configuration missing"
      });
    }

    const cleanId = orderId.replace("#", "").trim();

    console.log("=================================");
    console.log("TRACKING REQUEST");
    console.log("Email:", email);
    console.log("Order:", cleanId);
    console.log("=================================");

    // Shopify Orders Fetch
    const shopifyRes = await fetch(
      `https://${SHOP}/admin/api/2025-01/orders.json?status=any&limit=250`,
      {
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Shopify Status:", shopifyRes.status);

    if (!shopifyRes.ok) {
      const errorText = await shopifyRes.text();

      console.error("Shopify API Error:");
      console.error(errorText);

      return res.json({
        error: "Shopify API Error"
      });
    }

    const data = await shopifyRes.json();

    console.log("Total Orders:", data.orders?.length);

    data.orders?.forEach((o) => {
      console.log(
        "Order:",
        o.name,
        "| Email:",
        o.email,
        "| Order Number:",
        o.order_number
      );
    });

    if (!data.orders || data.orders.length === 0) {
      return res.json({
        error: "No orders returned by Shopify"
      });
    }

    // Find Order
    const order = data.orders.find((o) => {

      const emailMatch =
        (o.email || "")
          .trim()
          .toLowerCase() ===
        email.trim().toLowerCase();

      const orderMatch =
        String(o.order_number) === cleanId ||
        o.name === `#${cleanId}` ||
        o.name === orderId;

      if (orderMatch) {
        console.log(
          "Possible Match:",
          o.name,
          o.email,
          o.order_number
        );
      }

      return orderMatch && emailMatch;
    });

    console.log(
      "FOUND ORDER:",
      JSON.stringify(order, null, 2)
    );

    if (!order) {
      return res.json({
        error: "Order not found"
      });
    }

    const fulfillment =
      order.fulfillments &&
      order.fulfillments.length > 0
        ? order.fulfillments[0]
        : null;

    console.log(
      "FULFILLMENTS COUNT:",
      order.fulfillments?.length || 0
    );

    console.log(
      "FULFILLMENT DATA:",
      JSON.stringify(fulfillment, null, 2)
    );

    // ------------------------
    // TRACKING NUMBER
    // ------------------------

    let trackingNumber = "Not available";

    if (fulfillment) {

      console.log(
        "TRACKING DATA:",
        JSON.stringify(fulfillment, null, 2)
      );

      trackingNumber =
        fulfillment.tracking_number ||
        fulfillment.tracking_numbers?.[0] ||
        fulfillment.tracking_info?.[0]?.number ||
        fulfillment.shipment_tracking_number ||
        "Not available";
    }

    // ------------------------
    // COURIER
    // ------------------------

    const courierName =
      fulfillment?.tracking_company ||
      "Not assigned";

    const trackingUrl = getCourierLink(
      courierName,
      trackingNumber
    );

    // ------------------------
    // STATUS
    // ------------------------

    let shipmentStatus = "Processing";

    if (fulfillment) {
      shipmentStatus =
        fulfillment.shipment_status ||
        "In Transit";
    }

    // ------------------------
    // DELIVERY DATE
    // ------------------------

    let estimatedDelivery = "Updating...";

    if (
      fulfillment &&
      fulfillment.estimated_delivery_at
    ) {
      const d = new Date(
        fulfillment.estimated_delivery_at
      );

      estimatedDelivery =
        d.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric"
        });
    }
    else if (
      fulfillment &&
      fulfillment.created_at
    ) {
      const start = new Date(
        fulfillment.created_at
      );

      const end = new Date(
        fulfillment.created_at
      );

      start.setDate(start.getDate() + 4);
      end.setDate(end.getDate() + 7);

      estimatedDelivery =
        `${start.toLocaleDateString("en-IN")} - ${end.toLocaleDateString("en-IN")}`;
    }

    return res.json({
      success: true,
      orderId: order.name,
      status: shipmentStatus,
      trackingNumber,
      courier: courierName,
      trackingUrl,
      estimatedDelivery
    });

  } catch (err) {
    console.error("SERVER ERROR:");
    console.error(err);

    return res.json({
      error: err.message
    });
  }
});

// ------------------------
// HEALTH CHECK
// ------------------------

app.get("/", (req, res) => {
  res.send("Tracking API Running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
