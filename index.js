import 'dotenv/config';
import express from "express";
import bodyParser from "body-parser";
import { Pool } from "pg";

const app = express();
const port = 3000;

const db = new Pool({
 // user: "postgres",
  //host: "localhost",
  //database: "world",
  //password: "123456",
  //port: 5432,
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

let users = [
  { id: 1, name: "Angela", color: "teal" },
  { id: 2, name: "Jack", color: "powderblue" },
];

async function checkVisisted() {
  const result = await db.query(
    "SELECT c.country_code, c.country_name FROM visited_countries vc JOIN countries c ON c.country_code = vc.country_code WHERE vc.user_id = $1 ORDER BY c.country_name ASC;",
    [currentUserId]
  );
  
  // لطباعة البيانات والتأكد منها في سجلات Vercel
  console.log("Visited countries data:", result.rows); 
  
  return result.rows;
}

async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users");
  users = result.rows;
  return users.find((user) => user.id == currentUserId);
}

app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  const currentUser = await getCurrentUser();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUser.color,
  });
});
app.post("/add", async (req, res) => {
  const input = req.body.country;

  try {
    const countryResult = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    // الحالة الأولى: الدولة غير موجودة
    if (countryResult.rows.length === 0) {
      const countries = await checkVisisted();
      const currentUser = await getCurrentUser();
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUser.color,
        error: "Country not found. Please try again.", // <--- رسالة الخطأ
      });
      return; // نوقف التنفيذ هنا
    }
    
    const countryCode = countryResult.rows[0].country_code;

    // نتأكد مما إذا كانت الدولة تمت إضافتها من قبل
    const visitedResult = await db.query(
      "SELECT * FROM visited_countries WHERE country_code = $1 AND user_id = $2",
      [countryCode, currentUserId]
    );

    // الحالة الثانية: الدولة تمت إضافتها من قبل
    if (visitedResult.rows.length > 0) {
      const countries = await checkVisisted();
      const currentUser = await getCurrentUser();
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUser.color,
        error: "You have already added this country.", // <--- رسالة الخطأ
      });
      return; // نوقف التنفيذ هنا
    }

    // إذا كانت الدولة موجودة وليست مكررة، نقوم بإضافتها
    await db.query(
      "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
      [countryCode, currentUserId]
    );
    res.redirect("/");

  } catch (err) {
    console.log(err);
    // يمكنك التعامل مع الأخطاء العامة هنا إذا أردت
    res.redirect("/");
  }
});
app.post("/delete", async (req, res) => {
  const countryCode = req.body.countryCode; // سنرسل هذا من الواجهة الأمامية

  try {
    await db.query(
      "DELETE FROM visited_countries WHERE country_code = $1 AND user_id = $2",
      [countryCode, currentUserId]
    );
    res.redirect("/"); // أعد التوجيه إلى الصفحة الرئيسية بعد الحذف
  } catch (err) {
    console.log(err);
    res.redirect("/");
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
    "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
    [name, color]
  );

  const id = result.rows[0].id;
  currentUserId = id;

  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
