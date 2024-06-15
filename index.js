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

// verify jwt middleware

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "unauthorized access" });
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.log(err);
        return res.status(401).send({ message: "unauthorized access" });
      }
      req.user = decoded;
      next();
    });
  }
};

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
    const commentCollection = client
      .db("synapseForumDB")
      .collection("comments");

    // jwt generate
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // clear token on logout

    app.get("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 0,
        })
        .send({ success: true });
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

    // user wishlist data
    app.get("/my-post/:email", verifyToken, async (req, res) => {
      const tokenEmail = req.user.email;
      const email = req.params.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }
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

    // Get comments by postId
    app.get("/comments/:postId", async (req, res) => {
      const postId = req.params.postId;
      const query = { postId: postId }; // Assuming postId is stored in the 'postId' field of comments

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
