require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("./models/admin");

// Connect to MongoDB
mongoose.connect("mongodb+srv://anonymous:anonymous@cluster0.3hdvk.mongodb.net/myFirstDatabase")
  .then(async () => {
    console.log("Connected to MongoDB");
    
    // Create default admin user
    const adminExists = await Admin.findOne({ adminEmail: "admin@outlook-proxy.com" });
    
    if (!adminExists) {
      const admin = new Admin({
        adminEmail: "admin@outlook-proxy.com",
        adminPassword: "admin123",
        permissions: ['view_users', 'inject_cookies', 'manage_users']
      });
      
      await admin.save();
      console.log("Default admin created:");
      console.log("Email: admin@outlook-proxy.com");
      console.log("Password: admin123");
    } else {
      console.log("Admin already exists");
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });