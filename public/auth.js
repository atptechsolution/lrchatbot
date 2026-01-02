/* ---------------- SIGNUP ---------------- */
async function signup() {
  const name = document.getElementById("name").value.trim();
  const mobile = document.getElementById("mobile").value.trim();
  const msg = document.getElementById("msg");

  if (!name || !mobile) {
    msg.innerText = "❌ Name and mobile required";
    return;
  }

  const res = await fetch("/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mobile })
  });

  const data = await res.json();
  msg.innerText = data.msg;
}


/* ---------------- LOGIN ---------------- */
async function login() {
  const mobile = document.getElementById("mobile").value.trim();
  const msg = document.getElementById("msg");

  msg.innerText = "";

  // Validation
  if (!mobile || mobile.length < 10) {
    msg.innerText = "❌ Please enter a valid mobile number";
    return;
  }

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    });

    const data = await res.json();

    /* -------- ADMIN LOGIN -------- */
    if (mobile === "8085074606" && data.role === "admin") {
      localStorage.setItem("mobile", mobile); // IMPORTANT
      window.location.href = "/admin.html";
      return;
    }

    /* -------- USER LOGIN -------- */
    if (data.role === "user") {
      localStorage.setItem("mobile", mobile);
      window.location.href = "/chat.html";
      return;
    }

    /* -------- ERROR MESSAGE -------- */
    msg.innerText = data.msg || "❌ Login failed";
  } catch (err) {
    console.error("Login error:", err);
    msg.innerText = "❌ Server error during login";
  }
}
