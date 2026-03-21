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

    console.log("FULL RESPONSE:", data); // 👈 IMPORTANT

    if (data.error) {
      return res.send("OAuth error: " + JSON.stringify(data));
    }

    res.send("SUCCESS: " + data.access_token);

  } catch (err) {
    console.error("CATCH ERROR:", err);
    res.send("OAuth crash");
  }
});
