const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rzv4y0u.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//  middleware
// Suppose we want to check url which i called from client side.

const logger = async (req, res, next) => {
  console.log("called url", req.host, req.originalUrl);
  next();
};

// To verify token middleware

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  jwt.verify(token, process.env.SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      res.status(401).send({ message: "Unauthorized Access" });
    }
    console.log("Value in the token", decoded);
    req.loggedInUser = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const serviceCollection = client.db("carDoctor").collection("Services");
    const bookingsCollection = client.db("carDoctor").collection("bookings");

    app.get("/services", logger, async (req, res) => {
      let query = {};
      if (req.query?.title) {
        query = { title: req.query.title };
      }
      const cursor = serviceCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      // const options = {
      //   // Include only the `title` and  fields in the returned document
      //   projection: {  title: 1, img: 1, price: 1 },
      // };

      const result = await serviceCollection.findOne(query);
      res.send(result);

      // Auth related api

      app.post("/jwt", logger, async (req, res) => {
        const loggedInUser = req.body;
        console.log(loggedInUser);
        const token = jwt.sign(loggedInUser, process.env.SECRET, {
          expiresIn: "1h",
        });
        res
          .cookie("token", token, {
            httpOnly: true,
            sameSite: "none",
            secure: false,
          })
          .send({ success: true });
      });
    });

    // For booking the  order

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });

    // To get some data

    app.get("/bookings", logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      console.log('from valid token',req.loggedInUser);
      if(req.query.email !== req.loggedInUser.email){
        return res.status(403).send({message: 'forbidden'})
      }
      
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Doctor server is running");
});

app.listen(port, () => {
  console.log(`Car doctor is running on port: ${port}`);
});
