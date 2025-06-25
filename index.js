import 'dotenv/config'; // الطريقة الحديثة لتفعيل متغيرات البيئة
import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

// إعداد الاتصال بقاعدة البيانات باستخدام متغيرات البيئة
const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  // ملاحظة: تأكد من أن اسم المتغير هنا يطابق ما قمت بإعداده على Render/Vercel
  database: process.env.DB_DATABASE, 
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

// دالة لجلب كل الدول التي زارها المستخدم الحالي
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

// دالة لجلب كل المستخدمين من قاعدة البيانات
async function getAllUsers() {
    const result = await db.query("SELECT * FROM users ORDER BY id");
    return result.rows;
}

// المسار الرئيسي لعرض الصفحة
app.get("/", async (req, res) => {
  const users = await getAllUsers();
  const countries = await checkVisisted();
  const currentUser = users.find((user) => user.id == currentUserId);
  
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUser.color,
    // تم إصلاح الخطأ: إضافة currentUser لكي يتمكن EJS من عرضه
    currentUser: currentUser, 
    error: null,
  });
});

// مسار لإضافة دولة جديدة
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
    // تم إصلاح الخطأ: إضافة currentUser لكي يتمكن EJS من عرضه عند حدوث خطأ
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

// مسار للتبديل بين المستخدمين أو إضافة مستخدم جديد
app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

// مسار لمعالجة بيانات المستخدم الجديد
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
  console.log(`Server running on http://localhost:${port}`);
});