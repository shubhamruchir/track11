<style>
  .track-container { max-width: 500px; margin: 40px auto; padding: 30px; font-family: sans-serif; border: 1px solid #eaeaea; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
  .track-input { width: 100%; padding: 12px; margin-top: 8px; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; }
  .track-btn { width: 100%; background-color: #000; color: #fff; padding: 14px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px; transition: background 0.3s; }
  .track-btn:hover { background-color: #333; }
  
  .timeline { display: none; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; }
  .step { display: flex; align-items: center; margin-bottom: 20px; position: relative; }
  .step:last-child { margin-bottom: 0; }
  
  .step:not(:last-child)::after {
    content: ''; position: absolute; left: 14px; top: 30px; bottom: -20px; width: 2px; background-color: #eee; z-index: 1;
  }
  .step.completed:not(:last-child)::after { background-color: #22c55e; } 

  .circle { width: 30px; height: 30px; border-radius: 50%; background-color: #eee; display: flex; justify-content: center; align-items: center; margin-right: 15px; z-index: 2; font-weight: bold; color: white; transition: 0.3s; }
  .step.completed .circle { background-color: #22c55e; border: none; } 
  .step.active .circle { background-color: #22c55e; box-shadow: 0 0 0 4px #dcfce7; } 

  .step-info { flex: 1; }
  .step-title { margin: 0; font-weight: bold; font-size: 15px; color: #aaa; }
  .step.completed .step-title, .step.active .step-title { color: #000; }
  .step-desc { margin: 4px 0 0 0; font-size: 13px; color: #777; }
</style>

<div class="track-container">
  <h2 style="text-align: center; margin-bottom: 25px;">Track Your Order</h2>
  
  <form id="tracking-form">
    <label style="font-weight: 600; font-size: 14px;">Order Number</label>
    <input type="text" id="order-id" class="track-input" placeholder="e.g. #1024" required>
    
    <label style="font-weight: 600; font-size: 14px;">Email Address</label>
    <input type="email" id="order-email" class="track-input" placeholder="Email used at checkout" required>
    
    <button type="submit" class="track-btn">Track Order</button>
  </form>

  <div id="error-msg" style="color: red; margin-top: 15px; text-align: center; display: none;"></div>

  <div class="timeline" id="timeline">
    <div style="margin-bottom: 20px;">
      <p style="margin:0;"><strong>Courier:</strong> <span id="ui-courier">...</span></p>
      <p style="margin:5px 0;"><strong>Tracking No:</strong> <span id="ui-tracking">...</span></p>
      <p style="margin:5px 0;"><strong>Est. Delivery:</strong> <span id="ui-est">...</span></p>
      <a id="ui-link" href="#" target="_blank" style="display: none; color: #000; font-weight: bold; margin-top: 10px; text-decoration: underline;">View Live Courier Page &rarr;</a>
    </div>

    <div class="step" id="step-1">
      <div class="circle">✓</div>
      <div class="step-info">
        <p class="step-title">Order Placed</p>
        <p class="step-desc">We have received your order.</p>
      </div>
    </div>
    
    <div class="step" id="step-2">
      <div class="circle">✓</div>
      <div class="step-info">
        <p class="step-title">Order Picked Up</p>
        <p class="step-desc">Handed over to the courier partner.</p>
      </div>
    </div>
    
    <div class="step" id="step-3">
      <div class="circle">✓</div>
      <div class="step-info">
        <p class="step-title">In Transit</p>
        <p class="step-desc">Package is moving between facilities.</p>
      </div>
    </div>

    <div class="step" id="step-4">
      <div class="circle">✓</div>
      <div class="step-info">
        <p class="step-title">Out for Delivery</p>
        <p class="step-desc">Out with the delivery agent reaching your door.</p>
      </div>
    </div>
    
    <div class="step" id="step-5">
      <div class="circle">✓</div>
      <div class="step-info">
        <p class="step-title">Delivered</p>
        <p class="step-desc">Package has been successfully delivered.</p>
      </div>
    </div>
  </div>
</div>

<script>
document.getElementById('tracking-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const btn = e.target.querySelector('button');
  const timeline = document.getElementById('timeline');
  const errorMsg = document.getElementById('error-msg');
  
  btn.innerText = 'Searching...';
  timeline.style.display = 'none';
  errorMsg.style.display = 'none';

  for(let i=1; i<=5; i++) {
    document.getElementById(`step-${i}`).className = 'step';
  }

  const payload = {
    orderId: document.getElementById('order-id').value,
    email: document.getElementById('order-email').value
  };

  try {
    // Calling your live Render API
    const response = await fetch('https://track11-13eq.onrender.com/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.error) {
      errorMsg.innerText = data.error;
      errorMsg.style.display = 'block';
    } else {
      document.getElementById('ui-courier').innerText = data.courier;
      document.getElementById('ui-tracking').innerText = data.trackingNumber;
      document.getElementById('ui-est').innerText = data.estimatedDelivery;
      
      const linkEl = document.getElementById('ui-link');
      if(data.trackingUrl) {
        linkEl.href = data.trackingUrl;
        linkEl.style.display = 'inline-block';
      } else {
        linkEl.style.display = 'none';
      }

      // ✅ UPGRADED STATUS VOCABULARY MATCHER
      const status = (data.status || "").toLowerCase();
      let currentStep = 1;

      if (status === 'delivered') {
        currentStep = 5;
      } else if (status === 'out_for_delivery' || status === 'attempted_delivery') {
        currentStep = 4;
      } else if (status === 'in_transit') {
        currentStep = 3;
      } else if (
        status === 'shipped' || 
        status === 'fulfilled' || 
        status === 'ready_for_pickup' || 
        status === 'confirmed' || 
        status === 'label_printed' || 
        status === 'label_purchased'
      ) {
        currentStep = 2;
      } else {
        currentStep = 1; 
      }

      for(let i=1; i<=5; i++) {
        const stepEl = document.getElementById(`step-${i}`);
        if (i < currentStep) {
          stepEl.classList.add('completed');
        } else if (i === currentStep) {
          stepEl.classList.add('active');
          if(currentStep === 5) stepEl.classList.add('completed');
        }
      }

      timeline.style.display = 'block';
    }
  } catch (err) {
    errorMsg.innerText = "Failed to connect to tracking server.";
    errorMsg.style.display = 'block';
  } finally {
    btn.innerText = 'Track Order';
  }
});
</script>
