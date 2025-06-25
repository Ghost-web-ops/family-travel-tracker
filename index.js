import 'dotenv/config'; 
import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Vercel ستوفر المنفذ تلقائيًا
const port = process.env.PORT || 3000;

// -- التغيير الأهم: استخدام pg.Pool لإدارة الاتصالات بكفاءة --
const db = new pg.Pool({
  // Vercel تستخدم هذا المتغير للاتصال الآمن. قم بإنشائه في إعدادات Vercel.
  connectionString: process.env.DATABASE_URL, 
  ssl: {
    rejectUnauthorized: false // ضروري للاتصال بقواعد البيانات على Supabase/Render
  }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

let currentUserId = 1;

// ملاحظة هامة للمطور: استخدام متغير عام مثل 'currentUserId'
// غير مناسب للتطبيقات الحقيقية لأنه سيتم مشاركته بين كل المستخدمين.
// الحل الاحترافي هو استخدام الجلسات (Sessions) أو التوكن (Tokens)
// لإدارة حالة كل مستخدم على حدة.

async function checkVisisted() {
  const result = await db.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1;",
    [currentUserId]
  );
  return result.rows.map(country => country.country_code);
}

async function getAllUsers() {
    const result = await db.query("SELECT * FROM users ORDER BY id");
    return result.rows;
}

app.get("/", async (req, res) => {
  try {
    const users = await getAllUsers();
    // التأكد من أن currentUserId هو رقم
    const currentUser = users.find((user) => user.id === currentUserId);
    
    if (!currentUser && users.length > 0) {
        // إذا لم يتم العثور على المستخدم الحالي، استخدم أول مستخدم كافتراضي
        currentUserId = users[0].id;
        res.redirect("/"); // إعادة تحميل الصفحة بالمستخدم الصحيح
        return;
    }

    const countries = await checkVisisted();
    
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: users,
      color: currentUser?.color || "grey", // استخدام Optional Chaining للأمان
      currentUser: currentUser, 
      error: null,
    });
  } catch(err) {
    console.error("Error connecting to database or fetching data:", err);
    res.status(500).send("<h3>Error connecting to the database.</h3><p>Please check the server logs and ensure your Environment Variables on Vercel are set correctly.</p>");
  }
});

app.post("/add", async (req, res) => {
    const input = req.body["country"];
  
    try {
      const users = await getAllUsers();
      const currentUser = users.find((user) => user.id === currentUserId);
      
      const result = await db.query(
        "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
        [input.toLowerCase().trim()]
      );
      
      if (result.rows.length === 0) {
        throw new Error("Country not found in the database. Please check the spelling.");
      }
  
      const countryCode = result.rows[0].country_code;
      const visitedCountries = await checkVisisted();
      if (visitedCountries.includes(countryCode)) {
         throw new Error("You have already added this country.");
      }
  
      await db.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
        [countryCode, currentUserId]
      );
  
      res.redirect("/");
  
    } catch (err) {
      const users = await getAllUsers();
      const countries = await checkVisisted();
      const currentUser = users.find((user) => user.id === currentUserId);
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUser?.color || "grey",
        currentUser: currentUser,
        error: err.message,
      });
    }
  });
  
  app.post("/user", async (req, res) => {
    if (req.body.add === "new") {
      res.render("new.ejs");
    } else {
      currentUserId = parseInt(req.body.user); // تحويل القيمة إلى رقم لضمان المقارنة الصحيحة
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

// يتم تجاهل هذا السطر عند النشر على Vercel، ولكنه ضروري للتشغيل المحلي
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server running locally on http://localhost:${port}`);
    });
}

export default app;