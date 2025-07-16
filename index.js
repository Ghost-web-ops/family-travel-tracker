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
    "SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1; ",
    [currentUserId]
  );
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
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
    // 1. نبحث عن رمز الدولة بناءً على الاسم المدخل
    const countryResult = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    if (countryResult.rows.length === 0) {
      // 2. إذا لم يتم العثور على الدولة، نعرض رسالة خطأ
      const countries = await checkVisisted();
      const currentUser = await getCurrentUser();
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUser.color,
        error: "Country not found, please try again.", // <--- رسالة الخطأ
      });
    } else {
      // 3. إذا تم العثور على الدولة، نحصل على رمزها
      const countryCode = countryResult.rows[0].country_code;

      // 4. نتأكد مما إذا كانت هذه الدولة قد تمت زيارتها بالفعل من قبل هذا المستخدم
      const visitedResult = await db.query(
        "SELECT * FROM visited_countries WHERE country_code = $1 AND user_id = $2",
        [countryCode, currentUserId]
      );

      if (visitedResult.rows.length > 0) {
        // 5. إذا كانت موجودة بالفعل، لا نفعل شيئًا ونعود للصفحة الرئيسية
        res.redirect("/");
      } else {
        // 6. إذا لم تكن موجودة، نضيفها إلى قاعدة البيانات
        await db.query(
          "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
          [countryCode, currentUserId]
        );
        res.redirect("/");
      }
    }
  } catch (err) {
    console.log(err);
    // يمكنك هنا أيضًا عرض صفحة خطأ عامة
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
