const express = require("express");
const mysql = require('mysql2');
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const cors = require("cors");
const path = require("path");
const multer = require('multer');
const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator"); 

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: ,
      pass: ,
    },
  });
  
  
const app = express();
const PORT = 5500; // Make sure this matches the port referenced in HTML files

// CORS Configuration
app.use(cors({
    origin: ["http://localhost:5500", "null"], // Add 'null' for file:// protocol
    credentials: true
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); 
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// MySQL Database Connection
const pool = mysql.createPool({
    host: "localhost",
    user: "root",      
    password: ,
    database: 
});

// Signup Route
app.post("/signup", async (req, res) => {
    const { username, email, password, confirm_password, phone_number } = req.body;

    if (!username || !email || !password || !confirm_password || !phone_number) {
        return res.status(400).json({ message: "All fields are required!" });
    }
    if (password !== confirm_password) {
        return res.status(400).json({ message: "Passwords do not match!" });
    }

    try {
        const [results] = await pool.promise().query("SELECT * FROM tbl_users WHERE email = ? OR username = ?", [email, username]);

        if (results.length > 0) {
            return res.status(400).json({ message: "Email or username already in use" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.promise().query(`
            INSERT INTO tbl_users (username, email, password_hash, phone_number)
            VALUES (?, ?, ?, ?)
        `, [username, email, hashedPassword, phone_number]);

        res.status(201).json({ message: "Signup successful! Please login." });

    } catch (error) {
        console.error("❌ Signup Error:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Login Route
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const [results] = await pool.promise().query("SELECT user_id, email, password_hash FROM tbl_users WHERE email = ?", [email]);

        if (results.length === 0) {
            return res.status(400).json({ message: "User not found" });
        }

        const user = results[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        res.status(200).json({ message: "Login successful", user_id: user.user_id });

    } catch (error) {
        console.error("❌ Login Error:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "uploads/"); // Save images in "uploads" folder
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + "-" + file.originalname); // Unique filename
    },
  });
  const upload = multer({ storage: storage });
  
  // ✅ Fetch Categories
  app.get("/categories", (req, res) => {
    const query = "SELECT * FROM tbl_scrap_categories";
    pool.query(query, (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });
      res.status(200).json(results);
    });
  });
  
  // ✅ Fetch Subcategories based on Category ID
app.get("/subcategories/:categoryId", (req, res) => {
    const categoryId = req.params.categoryId;
    const query = "SELECT * FROM tbl_scrap_subcategories WHERE category_id = ?";

    pool.query(query, [categoryId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: "Database query error" });
        }
        res.json(results);
    });
});



  app.post("/submit-scrap", upload.single("image"), (req, res) => {
    const { user_id, category_id, subcategories } = req.body;
    const image_path = req.file ? req.file.path : null;

    if (!user_id || !category_id || !subcategories) {
        return res.status(400).json({ message: "All fields are required!" });
    }

    const selectedSubcategories = JSON.parse(subcategories); // Convert string back to array

    if (!Array.isArray(selectedSubcategories) || selectedSubcategories.length === 0) {
        return res.status(400).json({ message: "Invalid subcategories data!" });
    }

    const query = 'INSERT INTO tbl_user_scrap_selections (user_id, category_id, subcategory_id, image_path) VALUES ?';

    const values = selectedSubcategories.map(subcategory_id => [user_id, category_id, subcategory_id, image_path]);

    pool.query(query, [values], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database error" });
        }
        res.status(201).json({ message: "Scrap selections saved successfully!" });
    });
});

app.post("/addScraplist", (req, res) => {
    console.log("Request Headers:", req.headers);
    console.log("Request Session:", req.session);
    console.log("Request Body:", req.body);
  
    const { subcategories } = req.body;
  
    if (!subcategories || !subcategories.length) {
        console.log("Invalid Data Received!");
        return res.status(400).json({ message: "Invalid data" });
    }
  
    // Fetch user_id from session or headers
    const user_id = req.session?.user_id || req.headers?.user_id;
  
    if (!user_id) {
        console.log("Error: user_id is undefined!");
        return res.status(401).json({ message: "User not authenticated" });
    }
  
    // Fetch user details (including email and phone_number)
    const userQuery = "SELECT user_id, username, email, phone_number FROM tbl_users WHERE user_id = ?"; 
  
    pool.query(userQuery, [user_id], (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ message: "Database error" });
        }
  
        if (results.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
  
        const { user_id, username, email, phone_number } = results[0];
  
        // Insert into scraplist
        const values = subcategories.map(sub => [user_id, username, email, phone_number, sub]);
        const insertQuery = "INSERT INTO scraplist (user_id, username, email, phone_number, subcategory) VALUES ?";
  
        pool.query(insertQuery, [values], (err, result) => {
            if (err) {
                console.error("Database Error:", err);
                return res.status(500).json({ message: "Database error" });
            }
            res.status(200).json({ message: "Scrap subcategories added successfully!" });
        });
    });
  });

  app.get('/get_nearby_shops', (req, res) => {
    const userLat = parseFloat(req.query.lat);
    const userLon = parseFloat(req.query.lon);
    const radius = 25; // Set radius in kilometers
  
    const query = `
      SELECT shop_id, shop_name,  latitude, longitude, shop_address,
      (6371 * ACOS(COS(RADIANS(?)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(?)) + 
      SIN(RADIANS(?)) * SIN(RADIANS(latitude)))) AS distance
      FROM  tbl_scrap_shops
      HAVING distance < ?
      ORDER BY distance ASC;
    `;
  
    pool.query(query, [userLat, userLon, userLat, radius], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Server error');
      }
      res.json(results);
    });
  });
  app.post("/save-selected-shop", async (req, res) => {
    const { user_id, location_name, shop_id, user_lat, user_lon } = req.body;
  
    if (!user_id || !location_name || !shop_id || !user_lat || !user_lon) {
      return res.status(400).json({ message: "All fields are required!" });
    }
  
    const query = `
      INSERT INTO tbl_user_selected_shops (user_id, location_name, shop_id, user_lat, user_lon) 
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        shop_id = VALUES(shop_id), 
        user_lat = VALUES(user_lat), 
        user_lon = VALUES(user_lon), 
        location_name = VALUES(location_name);
    `;
  
    pool.query(query, [user_id, location_name, shop_id, user_lat, user_lon], (err) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }
      res.status(201).json({ message: "Shop selection and user location saved successfully!" });
    });
  });
  
  app.post("/schedule-pickup", (req, res) => {
    const { user_id, shop_id, pickup_date, pickup_time } = req.body;
  
    // Validate all fields
    if (!user_id || !shop_id || !pickup_date || !pickup_time) {
      return res.status(400).json({ message: "All fields are required!" });
    }
  
    const query = `
      INSERT INTO tbl_pickup_schedules (user_id, shop_id, pickup_date, pickup_time)
      VALUES (?, ?, ?, ?)
    `;
  
    pool.query(query, [user_id, shop_id, pickup_date, pickup_time], (err) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }
      res.status(201).json({ message: "Pickup scheduled successfully!" });
    });
  });
      
  app.get("/get-pickup-details", (req, res) => {
    const { user_id } = req.query;

    if (!user_id) {
        return res.json({ success: false, message: "Missing user ID" });
    }

    // First, get the latest timestamp for this user
    const latestTimestampQuery = `
        SELECT MAX(created_at) as latest_timestamp
        FROM scraplist
        WHERE user_id = ?
    `;

    pool.query(latestTimestampQuery, [user_id], (timestampErr, timestampResults) => {
        if (timestampErr) {
            console.error("Error fetching latest timestamp:", timestampErr);
            return res.json({ success: false, message: "Database error" });
        }

        if (timestampResults.length === 0 || !timestampResults[0].latest_timestamp) {
            return res.json({ success: false, message: "No pickups found" });
        }

        const latestTimestamp = timestampResults[0].latest_timestamp;

        // Now get all subcategories with this timestamp
       // Now get all subcategories with this timestamp
const userQuery = `
SELECT s.username, s.email, s.phone_number, s.subcategory, 
    p.pickup_date, p.pickup_time, 
    (SELECT location_name FROM tbl_user_selected_shops 
     WHERE user_id = s.user_id 
     ORDER BY selected_at DESC LIMIT 1) as location_name
FROM scraplist s
LEFT JOIN tbl_pickup_schedules p ON s.user_id = p.user_id
WHERE s.user_id = ?
AND s.created_at = ?
ORDER BY s.subcategory
`;

        pool.query(userQuery, [user_id, latestTimestamp], (userErr, userResults) => {
            if (userErr) {
                console.error("Error fetching user details:", userErr);
                return res.json({ success: false, message: "Database error" });
            }

            if (userResults.length === 0) {
                return res.json({ success: false, message: "No pickup found" });
            }

            const shopQuery = `
                SELECT ss.shop_name, ss.shop_address
                FROM tbl_user_selected_shops uss
                JOIN tbl_scrap_shops ss ON uss.shop_id = ss.shop_id
                WHERE uss.user_id = ?
                ORDER BY uss.selected_at DESC LIMIT 1
            `;

            pool.query(shopQuery, [user_id], (shopErr, shopResults) => {
                if (shopErr) {
                    console.error("Error fetching shop details:", shopErr);
                    return res.json({ success: false, message: "Database error" });
                }

                let shop_name = "Unknown Shop";
                let shop_address = "Unknown Address";

                if (shopResults.length > 0) {
                    shop_name = shopResults[0].shop_name;
                    shop_address = shopResults[0].shop_address;
                }

                // Get all subcategories as a comma-separated string
                const subcategories = [...new Set(userResults.map(row => row.subcategory))].join(", ");

      
        

                // Take the first result for other user info since it should be the same
                const userInfo = userResults[0];

                res.json({
                    success: true,
                    pickup: {
                        username: userInfo.username,
                        email: userInfo.email,
                        phone: userInfo.phone_number,
                        subcategories: subcategories, // All subcategories as a string
                        pickup_date: userInfo.pickup_date,
                        pickup_time: userInfo.pickup_time,
                        location_name: userInfo.location_name,
                        shop_name: shop_name,
                        shop_address: shop_address
                    }
                });
            });
        });
    });
});
app.post("/confirm-pickup", (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
      return res.status(400).json({ success: false, message: "User ID is required" });
  }

  // First, get the latest timestamp for this user
  const latestTimestampQuery = `
      SELECT MAX(created_at) as latest_timestamp
      FROM scraplist
      WHERE user_id = ?
  `;

  pool.query(latestTimestampQuery, [user_id], (timestampErr, timestampResults) => {
      if (timestampErr) {
          console.error("Error fetching latest timestamp:", timestampErr);
          return res.status(500).json({ success: false, message: "Database error" });
      }

      if (timestampResults.length === 0 || !timestampResults[0].latest_timestamp) {
          return res.status(404).json({ success: false, message: "No pickups found" });
      }

      const latestTimestamp = timestampResults[0].latest_timestamp;

      // Get user info and all subcategories
      // Get user info and all subcategories
const userQuery = `
SELECT DISTINCT s.username, s.email, s.phone_number,
    p.pickup_date, p.pickup_time,
    (SELECT location_name FROM tbl_user_selected_shops 
     WHERE user_id = s.user_id 
     ORDER BY selected_at DESC LIMIT 1) as location_name,
    (SELECT ss.shop_name FROM tbl_user_selected_shops uss
     JOIN tbl_scrap_shops ss ON uss.shop_id = ss.shop_id
     WHERE uss.user_id = s.user_id
     ORDER BY uss.selected_at DESC LIMIT 1) as shop_name,
    (SELECT ss.shop_address FROM tbl_user_selected_shops uss
     JOIN tbl_scrap_shops ss ON uss.shop_id = ss.shop_id
     WHERE uss.user_id = s.user_id
     ORDER BY uss.selected_at DESC LIMIT 1) as shop_address,
    GROUP_CONCAT(DISTINCT s.subcategory ORDER BY s.subcategory SEPARATOR ', ') AS subcategories
FROM scraplist s
LEFT JOIN tbl_pickup_schedules p ON s.user_id = p.user_id
WHERE s.user_id = ?
AND s.created_at = ?
GROUP BY s.username, s.email, s.phone_number, p.pickup_date, p.pickup_time
`;

      pool.query(userQuery, [user_id, latestTimestamp], (err, results) => {
          if (err) {
              console.error("Error fetching pickup details:", err);
              return res.status(500).json({ success: false, message: "Database error" });
          }

          if (results.length === 0) {
              return res.status(404).json({ success: false, message: "No pickup details found" });
          }
          
          // Use the first result for user info
          const userInfo = results[0];
          
          // Insert a single record with comma-separated subcategories
          const insertQuery = `
              INSERT INTO tbl_confirmed_pickups 
              (user_id, username, email, phone_number, subcategory, pickup_date, pickup_time, location_name, shop_name, shop_address) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          pool.query(insertQuery, [
              user_id, userInfo.username, userInfo.email, userInfo.phone_number, userInfo.subcategories,
              userInfo.pickup_date, userInfo.pickup_time, userInfo.location_name, userInfo.shop_name, userInfo.shop_address
          ], (insertErr) => {
              if (insertErr) {
                  console.error("Error inserting pickup confirmation:", insertErr);
                  return res.status(500).json({ success: false, message: "Database insertion error" });
              }
              
              res.json({ 
                  success: true, 
                  message: "Pickup confirmed and stored successfully!",
                  subcategories: userInfo.subcategories
              });
          });
      });
  });
});
// Cancel Pickup Route
app.post("/cancel-pickup", (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
      return res.json({ success: false, message: "Missing user ID" });
  }

  // Fetch pickup_id from tbl_pickup_schedules
  const fetchQuery = `
      SELECT pickup_id FROM tbl_pickup_schedules WHERE user_id = ? LIMIT 1;
  `;

  pool.query(fetchQuery, [user_id], (err, results) => {
      if (err) {
          console.error("Error fetching pickup ID:", err);
          return res.json({ success: false, message: "Database error" });
      }

      if (results.length === 0) {
          return res.json({ success: false, message: "No pickup found for this user" });
      }

      const pickup_id = results[0].pickup_id;

      // Update status to 'Cancelled'
      const updateQuery = `
          UPDATE tbl_pickup_schedules 
          SET status = 'Cancelled' 
          WHERE user_id = ? AND pickup_id = ?;
      `;

      pool.query(updateQuery, [user_id, pickup_id], (err, result) => {
          if (err) {
              console.error("Error canceling pickup:", err);
              return res.json({ success: false, message: "Database error" });
          }

          res.json({ success: true, message: "Pickup cancelled successfully" });
      });
  });
});


// ✅ Forgot Password Route
app.post("/forgot-password", (req, res) => {
    const { email } = req.body;
  
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
  
    const findUserQuery = "SELECT * FROM tbl_users WHERE email = ?";
    pool.query(findUserQuery, [email], (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });
  
      if (results.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
  
      const otp = otpGenerator.generate(6, {
        alphabets: false,
        upperCase: false,
        specialChars: false,
      });
      const updateOTPQuery = "UPDATE tbl_users SET password_reset_otp = ? WHERE email = ?";
      pool.query(updateOTPQuery, [otp, email], (err) => {
        if (err) {
          console.error("Database Error:", err);
          return res.status(500).json({ message: "Failed to store OTP" });
        }
      
        const mailOptions = {
          from: "scrapixmini17@gmail.com",
          to: email,
          subject: "Password Reset OTP",
          text: `Your OTP for password reset is: ${otp}`,
        };
  
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return res.status(500).json({ message: "Failed to send OTP" });
          }
          res.status(200).json({ message: "OTP sent successfully" });
        });
      });
    });
  });
  app.post("/verify-otp", (req, res) => {
    const { email, otp } = req.body;
  
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }
  
    const checkOTPQuery = "SELECT * FROM tbl_users WHERE email = ? AND password_reset_otp = ?";
    pool.query(checkOTPQuery, [email, otp], (err, results) => {
      if (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ message: "Database error" });
      }
  
      if (results.length === 0) {
        return res.status(400).json({ message: "Invalid OTP. Try again." });
      }
  
      res.status(200).json({ success: true, message: "OTP verified. Enter new password." });
    });
  });
  app.post("/reset-password", async (req, res) => {
    const { email, newPassword } = req.body;
  
    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password are required" });
    }
  
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
  
      const updatePasswordQuery = "UPDATE tbl_users SET password_hash = ?, password_reset_otp = NULL WHERE email = ?";
      pool.query(updatePasswordQuery, [hashedPassword, email], (err, result) => {
        if (err) {
          console.error("Database Error:", err);
          return res.status(500).json({ message: "Failed to update password" });
        }
  
        if (result.affectedRows > 0) {
          res.status(200).json({ success: true, message: "Password reset successful! You can now log in." });
        } else {
          res.status(400).json({ message: "Error updating password." });
        }
      });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ message: "Something went wrong." });
    }
  });
        

  // API Route to Get User Details
app.post("/getUser", (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
      return res.status(400).json({ success: false, message: "User ID is required" });
  }

  const query = "SELECT  username,email,phone_number FROM tbl_users WHERE user_id = ?";
  
  pool.query(query, [user_id], (err, results) => {
      if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ success: false, message: "Database error" });
      }

      if (results.length > 0) {
          res.json({ success: true, data: results[0] });
      } else {
          res.status(404).json({ success: false, message: "User not found" });
      }
  });
});

app.post("/getUserHistory", (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
      return res.status(400).json({ success: false, message: "User ID is required" });
  }

  const sql = `
      SELECT 
          c.category_name, 
          s.subcategory_name, 
          COUNT(*) AS selection_count
      FROM tbl_user_scrap_selections AS us
      JOIN tbl_scrap_categories AS c ON us.category_id = c.category_id
      JOIN tbl_scrap_subcategories AS s ON us.subcategory_id = s.subcategory_id
      WHERE us.user_id = ?
      GROUP BY us.category_id, us.subcategory_id
  `;

  pool.query(sql, [user_id], (err, results) => {
      if (err) {
          console.error("Error fetching user history:", err);
          return res.status(500).json({ success: false, message: "Database error" });
      }

      res.json({ success: true, history: results });
  });
});

app.post("/getUserPickups", (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
      return res.status(400).json({ success: false, message: "User ID is required" });
  }

  const sql = `
      SELECT 
          id, 
          pickup_date, 
          subcategory, 
          status 
      FROM tbl_confirmed_pickups 
      WHERE user_id = ?
      ORDER BY pickup_date DESC
  `;

  pool.query(sql, [user_id], (err, results) => {
      if (err) {
          console.error("❌ Error fetching pickup schedules:", err);
          return res.status(500).json({ success: false, message: "Database error" });
      }

      console.log("✅ Pickup schedules fetched:", results);
      res.json({ success: true, pickups: results });
  });
});


  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  });
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
