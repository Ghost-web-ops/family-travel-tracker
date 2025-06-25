import 'dotenv/config'; 
import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

console.log("Attempting to create a new DB pool...");

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL, 
  ssl: {
    rejectUnauthorized: false
  }
});

console.log("DB pool created. Setting up middleware.");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

let currentUserId = 1;

async function checkVisisted() {
  console.log(`Checking visited for user: ${currentUserId}`);
  const result = await db.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1;",
    [currentUserId]
  );
  console.log("Visited countries fetched.");
  return result.rows.map(country => country.country_code);
}

async function getAllUsers() {
    console.log("Attempting to get all users...");
    const result = await db.query("SELECT * FROM users ORDER BY id");
    console.log(`Successfully fetched ${result.rows.length} users.`);
    return result.rows;
}

app.get("/", async (req, res) => {
  console.log("Root route ('/') accessed.");
  try {
    const users = await getAllUsers();
    const currentUser = users.find((user) => user.id === currentUserId);
    
    if (!currentUser && users.length > 0) {
        currentUserId = users[0].id;
        console.log(`Current user not found, redirecting to user ID: ${currentUserId}`);
        res.redirect("/");
        return;
    }

    const countries = await checkVisisted();
    
    console.log("Rendering index.ejs page.");
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: users,
      color: currentUser?.color || "grey",
      currentUser: currentUser, 
      error: null,
    });
  } catch(err) {
    console.error("--- CRITICAL ERROR IN ROOT ROUTE ---");
    console.error(err); // طباعة الخطأ الكامل
    res.status(500).send(`<h3>Error connecting to the database.</h3><p>Please check the server logs and ensure your Environment Variables on Vercel are set correctly.</p><pre>${err.stack}</pre>`);
  }
});

// ... باقي مسارات POST تبقى كما هي ...

app.post("/add", async (req, res) => {
    // ... الكود كما هو
});
 
app.post("/user", async (req, res) => {
    // ... الكود كما هو
});
 
app.post("/new", async (req, res) => {
    // ... الكود كما هو
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server running locally on http://localhost:${port}`);
    });
}

export default app;