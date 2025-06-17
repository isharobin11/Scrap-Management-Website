const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt=require("bcrypt");

const bodyParser = require("body-parser");

const app = express();
const PORT = 5001; // Admin API runs on port 5001

// Middleware
app.use(cors({
    origin: ["http://localhost:5001", "null"], // Add 'null' for file:// protocol
    credentials: true
}));
app.use(express.json());

// MySQL Database Connection (Admin DB)
const adminDB = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: ,
    database: ,
});

// ✅ Connect to miniproject (For fetching users)
const userDB = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: ,
    database: ,
});

// ✅ Connect both databases
adminDB.connect((err) => {
    if (err) {
        console.error("Admin Database Connection Failed:", err);
        return;
    }
    console.log("Connected to Scrapix Admin Database");
});

userDB.connect((err) => {
    if (err) {
        console.error("User Database Connection Failed:", err);
        return;
    }
    console.log("Connected to Miniproject Database");
});
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin123";

// Create Initial Admin User
function createInitialAdmin() {
    const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    
    adminDB.query("SELECT * FROM tbl_admin WHERE email = ?", [ADMIN_EMAIL], (err, results) => {
        if (err) {
            console.error("❌ Database error:", err);
            return;
        }

        if (results.length === 0) {
            adminDB.query("INSERT INTO tbl_admin (email, password) VALUES (?, ?)", 
                [ADMIN_EMAIL, hashedPassword], 
                (err) => {
                    if (err) console.error("❌ Insert Error:", err);
                    else console.log("✅ Initial admin user created.");
                }
            );
        } else {
            console.log("✅ Admin user already exists.");
        }
    });
}

createInitialAdmin();

// Admin Login Route
app.post("/api/admin/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    adminDB.query("SELECT * FROM tbl_admin WHERE email = ?", [email], (err, results) => {
        if (err) {
            console.error("❌ Admin Login Error:", err);
            return res.status(500).json({ message: "Server error, try again later." });
        }

        if (results.length === 0) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const admin = results[0];
        const isPasswordValid = bcrypt.compareSync(password, admin.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        res.status(200).json({ message: "Admin login successful!" });
    });
});


// ✅ Fetch All Users from miniproject.tbl_users
app.get("/api/admin/users", (req, res) => {
    userDB.query("SELECT user_id, username, email, phone_number FROM tbl_users", (err, results) => {
        if (err) {
            console.error("Error fetching users:", err);
            res.status(500).json({ message: "Error fetching users", error: err });
        } else {
            console.log("Fetched Users:", results);
            res.json(results);
        }
    });
});


// ✅ Fetch all categories
app.get("/api/admin/categories", (req, res) => {
    userDB.query("SELECT * FROM tbl_scrap_categories", (err, results) => {
        if (err) res.status(500).json({ message: "Error fetching categories", error: err });
        else res.json(results);
    });
});

// ✅ Add a new category
app.post("/api/admin/category", (req, res) => {
    const { category_name } = req.body;
    if (!category_name) return res.status(400).json({ message: "Category name required" });

    userDB.query("INSERT INTO tbl_scrap_categories (category_name) VALUES (?)", [category_name], (err) => {
        if (err) res.status(500).json({ message: "Error adding category", error: err });
        else res.json({ message: "Category added successfully" });
    });
});

// ✅ Delete a category (removes related subcategories & selections)
app.delete("/api/admin/category/:id", (req, res) => {
    const { id } = req.params;

    userDB.query("DELETE FROM tbl_scrap_categories WHERE category_id = ?", [id], (err) => {
        if (err) res.status(500).json({ message: "Error deleting category", error: err });
        else res.json({ message: "Category deleted successfully" });
    });
});

// ✅ Fetch subcategories of a specific category
app.get("/api/admin/subcategories/:category_id", (req, res) => {
    const { category_id } = req.params;

    userDB.query("SELECT * FROM tbl_scrap_subcategories WHERE category_id = ?", [category_id], (err, results) => {
        if (err) res.status(500).json({ message: "Error fetching subcategories", error: err });
        else res.json(results);
    });
});

// ✅ Add a new subcategory
app.post("/api/admin/subcategory", (req, res) => {
    const { category_id, subcategory_name, image_path } = req.body;
    if (!category_id || !subcategory_name) return res.status(400).json({ message: "All fields required" });

    userDB.query(
        "INSERT INTO tbl_scrap_subcategories (category_id, subcategory_name, image_path) VALUES (?, ?, ?)",
        [category_id, subcategory_name, image_path || null],
        (err) => {
            if (err) res.status(500).json({ message: "Error adding subcategory", error: err });
            else res.json({ message: "Subcategory added successfully" });
        }
    );
});

// ✅ Delete a subcategory
app.delete("/api/admin/subcategory/:id", (req, res) => {
    const { id } = req.params;

    userDB.query("DELETE FROM tbl_scrap_subcategories WHERE subcategory_id = ?", [id], (err) => {
        if (err) res.status(500).json({ message: "Error deleting subcategory", error: err });
        else res.json({ message: "Subcategory deleted successfully" });
    });
});

app.get("/api/admin/shops", (req, res) => {
    userDB.query("SELECT * FROM tbl_scrap_shops", (err, results) => {
        if (err) res.status(500).json({ message: "Error fetching categories", error: err });
        else res.json(results);
    });
});





// Add a new scrap shop
app.post("/api/admin/shop", async (req, res) => {
    const { shop_name, latitude, longitude, shop_address } = req.body;

    if (!shop_name || !latitude || !longitude || !shop_address) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        await userDB.execute(
            "INSERT INTO tbl_scrap_shops (shop_name, latitude, longitude, shop_address) VALUES (?, ?, ?, ?)",
            [shop_name, latitude, longitude, shop_address]
        );
        res.json({ message: "Shop added successfully" });
    } catch (error) {
        console.error("Error adding shop:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Update shop details
app.put("/api/admin/shop/:id", async (req, res) => {
    const { shop_name, latitude, longitude, shop_address } = req.body;
    const shopId = req.params.id;

    if (!shop_name || !latitude || !longitude || !shop_address) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const [result] = await userDB.execute(
            "UPDATE tbl_scrap_shops SET shop_name=?, latitude=?, longitude=?, shop_address=? WHERE shop_id=?",
            [shop_name, latitude, longitude, shop_address, shopId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Shop not found" });
        }

        res.json({ message: "Shop updated successfully" });
    } catch (error) {
        console.error("Error updating shop:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Delete a scrap shop
app.delete("/api/admin/shop/:id", async (req, res) => {
    const shopId = req.params.id;

    try {
        const [result] = await userDB.execute("DELETE FROM tbl_scrap_shops WHERE shop_id=?", [shopId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Shop not found" });
        }

        res.json({ message: "Shop deleted successfully" });
    } catch (error) {
        console.error("Error deleting shop:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


// Fetch all confirmed pickups
app.get("/api/admin/confirmed-pickups", (req, res) => {
    userDB.query("SELECT * FROM tbl_confirmed_pickups", (err, results) => {
        if (err) {
            console.error("Error fetching confirmed pickups:", err);
            return res.status(500).json({ message: "Error fetching pickups", error: err });
        }
        res.json(results);
    });
});

// Update pickup status (Pending -> Completed or Cancelled)
app.put('/api/admin/update-confirmed-pickup/:id', (req, res) => {
    const { id } = req.params; // Pickup ID
    const { status } = req.body; // New status

    // Validate status
    if (!['Pending', 'Completed', 'Cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    console.log(`Received request to update confirmed pickup ID: ${id} with status: ${status}`);

    // Update the status in the database
    const updateQuery = "UPDATE tbl_confirmed_pickups SET status = ? WHERE id = ?";
    userDB.query(updateQuery, [status, id], (err, result) => {
        if (err) {
            console.error('Error updating confirmed pickup status:', err);
            return res.status(500).json({ error: 'Internal Server Error', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Pickup ID not found' });
        }

        console.log(`Confirmed Pickup ${id} successfully updated to ${status}`);
        res.json({ message: `Pickup ${id} has been marked as ${status}.` });
    });
});

// Start the Admin Server
app.listen(PORT, () => {
    console.log(`Admin server running on port ${PORT}`);
});
