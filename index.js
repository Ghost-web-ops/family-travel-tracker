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

// -- التغيير الأهم: استخدام pg.Pool بدلاً من pg.Client --
// Pool يدير الاتصالات بشكل أكثر كفاءة في البيئات السحابية
const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL, // Vercel و Render يفضلون استخدام رابط كامل
  // في حالة عدم توفر DATABASE_URL, سيستخدم التفاصيل المنفصلة
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false // ضروري للاتصال بقواعد البيانات على Render/Supabase
  }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

let currentUserId = 1;

// ... باقي الدوال تبقى كما هي، لأن db.query() تعمل بنفس الطريقة مع Pool

async function checkVisisted() {
  const result = await db.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1;",
    [currentUserId]
  );
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

async function getAllUsers() {
    const result = await db.query("SELECT * FROM users ORDER BY id");
    return result.rows;
}

// المسار الرئيسي لعرض الصفحة
app.get("/", async (req, res) => {
  try {
    const users = await getAllUsers();
    const countries = await checkVisisted();
    const currentUser = users.find((user) => user.id == currentUserId);
    
    if (!currentUser) {
        // إذا لم يتم العثور على المستخدم، اعرض الصفحة مع بيانات افتراضية
        return res.render("index.ejs", {
            countries: [], total: 0, users: users, color: "grey", currentUser: {name: "Guest"}, error: "Please select a user."
        });
    }

    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: users,
      color: currentUser.color,
      currentUser: currentUser, 
      error: null,
    });
  } catch(err) {
    console.error("Error fetching data for root route:", err);
    res.status(500).send("Error connecting to the database. Please check the server logs.");
  }
});

// ... باقي مسارات POST تبقى كما هي ...

app.post("/add", async (req, res) => {
    const input = req.body["country"];
    const users = await getAllUsers();
    const currentUser = users.find((user) => user.id == currentUserId);
  
    try {
      const result = await db.query(
        "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
        [input.toLowerCase()]
      );
      
      if (result.rows.length === 0) {
        throw new Error("This country does not exist in our database.");
      }
  
      const data = result.rows[0];
      const countryCode = data.country_code;
      
      const visitedCountries = await checkVisisted();
      if (visitedCountries.includes(countryCode)) {
         throw new Error("Country has already been added.");
      }
  
      await db.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
        [countryCode, currentUserId]
      );
  
      res.redirect("/");
  
    } catch (err) {
      const countries = await checkVisisted();
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUser.color,
        currentUser: currentUser,
        error: err.message,
      });
    }
  });
  
  app.post("/user", async (req, res) => {
    if (req.body.add === "new") {
      res.render("new.ejs");
    } else {
      currentUserId = req.body.user;
      res.redirect("/");
    }
  });
  
  app.post("/new", async (req, res) => {
    const name = req.body.name;
    const color = req.body.color;
  
    const result = await db.query(
      "INSERT INTO users (name, color) VALUES ($1, $2) RETURNING id",
      [name, color]
    );
  
    const id = result.rows[0].id;
    currentUserId = id;
    res.redirect("/");
  });

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;