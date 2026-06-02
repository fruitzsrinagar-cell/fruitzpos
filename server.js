// Add these lines at the VERY TOP of your server.js
const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']); // Uses Cloudflare and Google DNS

const express = require('express');
const mongoose = require('mongoose');
// ... rest of your code
const cors = require('cors');
const path = require('path');
const app = express();
const session = require('express-session');
// To this:
const MongoStore = require('connect-mongo').default;
// Set body parser limits to handle custom basket image string payloads safely
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// ...
app.use(session({
    secret: '70061498279682371735iffa',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: "mongodb+srv://Fruitzsrinagar:7006149827ifra@cluster0.spvxnp9.mongodb.net/FruitzPOS?retryWrites=true&w=majority" 
    }),
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        httpOnly: true 
    }
}));
// 2. Serve Static Files
app.use(express.static(path.join(__dirname, "public")));

// PASTE THIS NEW BLOCK INSTEAD:

// 1. Main Home URL for customers (Loads your fruit baskets page)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'userhomepage.html'));
});

// 2. Staff URL to access the POS Login system
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});



app.use(cors({
    origin: true,
    credentials: true
}));

// Standard Connection String (Fixed for ECONNREFUSED)
const mongoURI = "mongodb+srv://Fruitzsrinagar:7006149827ifra@cluster0.spvxnp9.mongodb.net/FruitzPOS?retryWrites=true&w=majority";

mongoose.connect(mongoURI, { 
    family: 4 
})
.then(() => console.log("Connected to MongoDB Atlas: Fruitz"))
.catch(err => {
    console.error("MongoDB Connection Error:", err);
    console.log("TIP: If this fails, try changing your DNS to Google (8.8.8.8) or Cloudflare (1.1.1.1)");
});

// --- SCHEMAS ---
// --- SCHEMAS ---
// --- PREMIUM BASKETS DRILLDOWN SCHEMA ---
const BasketItemSchema = new mongoose.Schema({
    tier: { 
        type: String, 
        required: true, 
      
    },
    name: { 
        type: String, 
        required: true 
    }, // The Level 3 Button title (e.g., "Eco Solo Pack", "Gourmet Picnic Special")
    description: { 
        type: String, 
        required: true 
    }, // The Level 4 text (e.g., "Includes 4 seasonal organic apples...")
    price: { 
        type: String, 
        required: true 
    }, // The final Level 4 price (e.g., "$18.50")
    image: { 
        type: String, 
        default: "" 
    } // Base64 data string accessible anywhere
});

// Create the model so the database can create a 'basketitems' collection
const BasketItem = mongoose.model('BasketItem', BasketItemSchema);




const BillSchema = new mongoose.Schema({
    id: String,
    date: { type: Date, default: Date.now },
    customer: String,
    phone: String,
    address: String,
    subtotal: Number,
    discount: Number,
    advance: Number,
    deliveryDate: String,
    deliveryTime: String,
    items: Array,
    total: Number,
    balance: Number,
    packagedOn: {
        type: String, // Stores format like "2026-06-02"
        default: ""
    },
    packagedTime: {
        type: String, // Stores format like "22:00"
        default: ""
    }, 
    orderSource: { 
        type: String, 
        default: 'offline' 
    }
}, { timestamps: true }); // Moved schema options here cleanly

const Bill = mongoose.model('Bill', BillSchema);

const HistorySchema = new mongoose.Schema({
    bill_id: String,
    edit_date: String,
    change_log: String
});
const History = mongoose.model('History', HistorySchema);

const MenuSchema = new mongoose.Schema({
    name: String,
    price: Number
});
const Menu = mongoose.model('Menu', MenuSchema);

// SCHEMA
const UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    role: { type: String, default: 'user' }
});

// MODEL
const User = mongoose.model('User', UserSchema); // ✅ MUST be here
// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next(); // User is logged in, proceed to the next function
    } else {
        res.status(401).json({ error: "Unauthorized. Please login." });
    }
};

// Apply it to your routes


// ROUTES (AFTER model)
app.get('/api/current-user', async (req, res) => {
    if (req.session && req.session.user) {
        const user = await User.findOne({ username: req.session.user });

        res.json({
            username: user.username,
            role: user.role
        });
    } else {
        res.status(401).json({ error: "Not logged in" });
    }
});
// Change this in server.js
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find(); 
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Could not fetch staff" });
    }
});

// Change this in server.js
app.post('/api/users/add', isAuthenticated, async (req, res) => {
    try {
        const currentUser = await User.findOne({ username: req.session.user });

        // 🔒 Only admin allowed
        if (!currentUser || currentUser.role !== 'admin') {
            return res.status(403).json({ error: "Access denied. Admins only." });
        }

        const { username, password, role } = req.body;

        const newUser = new User({ username, password, role });
        await newUser.save();

        res.status(200).json({ success: true });

    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});
// Add this to server.js
app.delete('/api/users/:username', async (req, res) => {
    try {
        const usernameToDelete = req.params.username;

        // Fetch the user first to check their role
        const user = await User.findOne({ username: usernameToDelete });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // BLOCK: Prevent deletion if role is 'admin' or username is 'admin'
        if (user.role === 'admin' || user.username.toLowerCase() === 'admin') {
            return res.status(403).json({ error: "Access Denied: Cannot delete Admin accounts." });
        }

        await User.findOneAndDelete({ username: usernameToDelete });
        res.json({ success: true, message: "Member deleted" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete member" });
    }
});
app.get('/api/next-bill-id', async (req, res) => {
    try {
        // 1. Fetch the last bill using the Mongoose 'Bill' model
        const lastBill = await Bill.find().sort({ _id: -1 }).limit(1).exec();
        
        // 2. Determine what the new ID should be
        let count = 1;
        if (lastBill.length > 0 && lastBill[0].id) {
            // Extract the number from your existing ID format (e.g., FR-260424-001)
            const parts = lastBill[0].id.split('-');
            count = parseInt(parts[2]) + 1;
        }

        // 3. Generate the new ID
        const d = new Date();
        const dateStr = `${d.getFullYear().toString().slice(-2)}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}`;
        const newId = `FR-${dateStr}-${count.toString().padStart(3,'0')}`;

        // 4. Send it back
        res.json({ billId: newId });

    } catch (err) {
        console.error("Error generating ID:", err);
        res.status(500).json({ error: "Could not generate ID" });
    }
});
app.get('/api/bills', async (req, res) => {
    try {
        const bills = await Bill.find().sort({ date: -1 });
        res.json(bills);
    } catch (err) { res.status(500).send(err); }
});
// Add this to your Node.js/Express backend
app.get('/api/bills/:id', async (req, res) => {
    try {
        const billId = req.params.id;
        console.log("Searching for Bill ID:", billId); // This will show in your terminal
        
        const bill = await Bill.findOne({ id: billId }); 
        
        if (!bill) {
            console.log("Bill not found in Database");
            return res.status(404).json({ message: "Bill not found" });
        }
        
        res.json(bill);
    } catch (err) {
        console.error("Database Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/bills', async (req, res) => {
    try {
        const data = req.body;
        
        // Ensure values are numbers
        const total = parseFloat(data.total) || 0;
        const advance = parseFloat(data.advance) || 0;
        
        // Calculate logic
        let balance = total - advance;
        
        // If it's an online order, force balance to 0
        if (data.orderSource === "ONLINE") {
            balance = 0;
        }

        const newBill = new Bill({
            ...data,
            total: total,
            advance: advance,
            balance: balance // Now the database has the correct number
        });
        
        await newBill.save();
        res.json({ success: true });
    } catch (err) { 
        res.status(500).send(err); 
    }
});
// --- NEW PACKAGING UPDATE ROUTE ---
app.patch('/api/bills/:id/packaging', async (req, res) => {
    try {
        const billId = req.params.id; // Extracts the custom Bill ID (e.g., FR-xxxxxx-xxx)
        const { packagedOn, packagedTime } = req.body;

        // Find the bill by your custom id field and update its details
        const updatedBill = await Bill.findOneAndUpdate(
            { id: billId },
            { 
                $set: { 
                    packagedOn: packagedOn, 
                    packagedTime: packagedTime 
                } 
            },
            { new: true } // Returns the newly modified document payload
        );

        if (!updatedBill) {
            return res.status(404).json({ error: "Bill transactional profile not found" });
        }

        // Add an audit trail entry for the package tracking change log
        const logEntry = `Sticky Tag printed: Package compiled on ${packagedOn} at ${packagedTime}`;
        const newHistory = new History({
            bill_id: billId,
            edit_date: new Date().toLocaleString(),
            change_log: logEntry
        });
        await newHistory.save();

        res.status(200).json({ success: true, message: "Packaging sync coordinates saved onto Cloud DB Cluster." });
    } catch (err) {
        console.error("Failed to commit packaging timestamp updates:", err);
        res.status(500).json({ error: "Cloud database updates rejected." });
    }
});
// --- UPDATED ROUTE IN server.js ---
app.put('/api/bills/:id', async (req, res) => {
    try {
        const billId = req.params.id; // This is now the MongoDB _id
        const updateData = req.body;
        
        // Find by _id and update
        const updatedBill = await Bill.findByIdAndUpdate(billId, updateData, { returnDocument: 'after' });
        
        if (!updatedBill) {
            return res.status(404).send("Bill not found");
        }

        const logEntry = `Updated: Advance to ${updateData.advance}, Delivery: ${updateData.deliveryDate} ${updateData.deliveryTime}`;
        
        const newHistory = new History({
            bill_id: updatedBill.id, // Using your custom bill ID for the log
            edit_date: new Date().toLocaleString(),
            change_log: logEntry
        });
        await newHistory.save();
        
        res.json({ message: "Updated and Logged" });
    } catch (err) { 
        res.status(500).send(err); 
    }
});

app.get('/api/bills/:id/history', async (req, res) => {
    try {
        const history = await History.find({ bill_id: req.params.id }).sort({ _id: -1 });
        res.json(history);
    } catch (err) { res.status(500).send(err); }
});

app.delete('/api/bills/:id', async (req, res) => {
    try {
        await Bill.findOneAndDelete({ id: req.params.id });
        res.json({ success: true });
    } catch (err) { res.status(500).send(err); }
});

app.get('/api/menu', async (req, res) => {
    try {
        const items = await Menu.find();
        res.json(items);
    } catch (err) { res.status(500).send(err); }
});

app.post('/api/menu', async (req, res) => {
    try {
        const newItem = new Menu(req.body);
        await newItem.save();
        res.json(newItem);
    } catch (err) { res.status(500).send(err); }
});
app.delete('/api/menu/:id', async (req, res) => {
    try {
        await Menu.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { 
        res.status(500).send(err); 
    }
});
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    
    if (user) {
        req.session.user = username; // This records the user as "logged in" on the server
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});
// Add this route in server.js
app.post('/api/logout', (req, res) => {
    // If you are using session middleware, add:
    if (req.session) {
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.json({ success: true });
        });
    } else {
        // Fallback if no session exists
        res.json({ success: true });
    }
});
// Add this to your server.js
app.patch('/api/users/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const updates = req.body; // e.g., { password: 'new' } or { role: 'manager' }

        const updatedUser = await User.findOneAndUpdate(
            { username: username },
            { $set: updates },
            { new: true }
        );

        if (!updatedUser) return res.status(404).json({ error: "User not found" });
        res.json({ success: true, message: "User updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});



             // BasketItem

// =================================================================
// --- BASKET API ENDPOINTS FOR CLIENT HOME & ADMIN VIEW ---
// =================================================================

// 1. GET ALL BASKETS: This reads everything from your MongoDB basket collection
app.get('/api/basket-items', async (req, res) => {
    try {
        const items = await BasketItem.find();
        res.json(items); // Sends the items back as a clean list
    } catch (err) { 
        res.status(500).json({ error: "Could not fetch basket items from database" }); 
    }
});

// 2. ADD A NEW BASKET OPTION: Receives form data from Admin Panel and saves it
app.post('/api/basket-items', async (req, res) => {
    try {
        const newItem = new BasketItem(req.body);
        await newItem.save(); // Saves it into MongoDB cloud
        res.json({ success: true, item: newItem });
    } catch (err) { 
        res.status(500).json({ error: "Could not save the new basket item" }); 
    }
});

// 3. DELETE A BASKET OPTION: Removes a variation instantly using its unique ID
app.delete('/api/basket-items/:id', async (req, res) => {
    try {
        await BasketItem.findByIdAndDelete(req.params.id); // Looks up ID and deletes
        res.json({ success: true, message: "Basket variation removed successfully" });
    } catch (err) { 
        res.status(500).json({ error: "Failed to delete the basket item" }); 
    }
});




// 4. Catch-all Route (Keep this at the very BOTTOM of your routes)
// CHANGE the catch-all block at the very bottom to look EXACTLY like this:
app.use((req, res) => {
    res.redirect('/');
});

app.listen(3000, '0.0.0.0', () => {
    console.log("Fruit'z Cloud Server is LIVE.");
});