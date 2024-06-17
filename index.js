const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: ["http://localhost:5174", "http://localhost:5173"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bv8l8yc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const postCollection = client.db("synapseForumDB").collection("allPosts");
    const userCollection = client.db("synapseForumDB").collection("users");
    const announcementCollection = client
      .db("synapseForumDB")
      .collection("announcements");
    const commentCollection = client
      .db("synapseForumDB")
      .collection("comments");

    // jwt generate
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // verify jwt middleware

    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // users related api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });


    // Sending posts data with pagination
    app.get("/posts", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 5;
      const skip = (page - 1) * limit;

      const totalPosts = await postCollection.countDocuments();
      const result = await postCollection
        .find()
        .sort({ posted_time: -1 }) // Sort by posted_time in descending order
        .skip(skip)
        .limit(limit)
        .toArray();

      res.send({
        totalPosts,
        totalPages: Math.ceil(totalPosts / limit),
        currentPage: page,
        posts: result,
      });
    });

    // single post data
    app.get("/posts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postCollection.findOne(query);
      res.send(result);
    });

    // user post data
    app.get("/my-post/:email", async (req, res) => {
      const email = req.params.email;
      const result = await postCollection
        .find({ author_email: email })
        .sort({ posted_time: -1 })
        .toArray();
      res.send(result);
    });

    // sending comment data
    app.get("/comments", async (req, res) => {
      const result = await commentCollection.find().toArray();
      res.send(result);
    });
    // sending announcement data
    app.get("/announcements", async (req, res) => {
      const result = await announcementCollection.find().toArray();
      res.send(result);
    });

    // single comments data
    app.get("/comment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await commentCollection.findOne(query);
      res.send(result);
    });

    // Get comments by postId
    app.get("/comments/:postId", async (req, res) => {
      const postId = req.params.postId;
      const query = { postId: postId };

      try {
        const result = await commentCollection.find(query).toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching comments:", err);
        res.status(500).send({ message: "Error fetching comments" });
      }
    });

    // save post data
    app.post("/posts", async (req, res) => {
      const postData = { ...req.body, posted_time: new Date() };
      const result = await postCollection.insertOne(postData);
      res.send(result);
    });

    // save upvote increments

    app.post("/posts/:id/upvote", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await postCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { upvote: 1 } }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error upvoting post" });
      }
    });
    // save downvote increments

    app.post("/posts/:id/downvote", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await postCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { downvote: 1 } }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error downvoting post" });
      }
    });

    // save comment data
    app.post("/comments", async (req, res) => {
      const commentData = req.body;
      const result = await commentCollection.insertOne(commentData);
      res.send(result);
    });

    // save comment data
    app.post("/announcements", async (req, res) => {
      const announcement = req.body;
      const result = await announcementCollection.insertOne(announcement);
      res.send(result);
    });

    // users related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      // insert email if user doesn't exist
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // updating users role
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // updating users membership
    app.patch("/users/membership/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          membership: "gold",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // remove data from posts
    app.delete("/posts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postCollection.deleteOne(query);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("synapse is running");
});

app.listen(port, () => {
  console.log(`Synapse forum is running on port ${port}`);
});
