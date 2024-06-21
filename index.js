const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: [
    "http://localhost:5174",
    "http://localhost:5173",
    "https://twelfth-assignment-forum.web.app",
    "https://twelfth-assignment-forum.firebaseapp.com",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

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
    // await client.connect();

    const postCollection = client.db("synapseForumDB").collection("allPosts");
    const userCollection = client.db("synapseForumDB").collection("users");
    const tagCollection = client.db("synapseForumDB").collection("tags");
    const announcementCollection = client
      .db("synapseForumDB")
      .collection("announcements");
    const commentCollection = client
      .db("synapseForumDB")
      .collection("comments");
    const paymentCollection = client
      .db("synapseForumDB")
      .collection("payments");
    const reportCollection = client.db("synapseForumDB").collection("reports");

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

    // get all users admin only
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Sending posts data with pagination and optional tag filter
    app.get("/posts", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 5;
      const skip = (page - 1) * limit;
      const tag = req.query.tag;

      let query = {};
      if (tag) {
        query = { tags: tag };
      }

      try {
        const totalPosts = await postCollection.countDocuments(query);
        const result = await postCollection
          .find(query)
          .sort({ posted_time: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        res.send({
          totalPosts,
          totalPages: Math.ceil(totalPosts / limit),
          currentPage: page,
          posts: result,
        });
      } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).send({ message: "Error fetching posts" });
      }
    });

    // get posts sorted by popularity
    app.get("/posts/popular", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 5;
      const skip = (page - 1) * limit;

      try {
        const totalPosts = await postCollection.countDocuments();

        const result = await postCollection
          .aggregate([
            {
              $addFields: {
                voteDifference: { $subtract: ["$upvote", "$downvote"] },
              },
            },
            {
              $sort: { voteDifference: -1 },
            },
            {
              $skip: skip,
            },
            {
              $limit: limit,
            },
          ])
          .toArray();

        res.send({
          totalPosts,
          totalPages: Math.ceil(totalPosts / limit),
          currentPage: page,
          posts: result,
        });
      } catch (error) {
        console.error("Error fetching popular posts:", error);
        res.status(500).send({ message: "Error fetching popular posts" });
      }
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

    // check admin data using email
    app.get("/admin-user/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      if (user) {
        res.send({ email: user.email, role: user.role });
      } else {
        res.status(404).send({ message: "User not found" });
      }
    });

    // check user data using email
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      if (user) {
        res.send({ email: user.email, membership: user.membership });
      } else {
        res.status(404).send({ message: "User not found" });
      }
    });

    // sending comment data
    app.get("/comments", async (req, res) => {
      const result = await commentCollection.find().toArray();
      res.send(result);
    });
    // sending comment data
    app.get("/reports", async (req, res) => {
      const result = await reportCollection.find().toArray();
      res.send(result);
    });

    // sending tag data
    app.get("/tags", async (req, res) => {
      const result = await tagCollection.find().toArray();
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

    app.get("/comments/byTitle/:postTitle", async (req, res) => {
      const postTitle = req.params.postTitle;
      const query = { postTitle: postTitle };

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

    // save tag data
    app.post("/tags", async (req, res) => {
      const tagData = req.body;
      const result = await tagCollection.insertOne(tagData);
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

    // remove upvote
    app.post("/posts/:id/remove-upvote", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await postCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { upvote: -1 } }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error removing upvote" });
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

    //handle reporting comments
    app.post("/reports", verifyToken, async (req, res) => {
      const { commentId, reason, comment } = req.body;
      const reportData = {
        commentId: new ObjectId(commentId),
        comment: comment,
        reportedBy: req.decoded.email,
        reason: reason,
        reportedAt: new Date(),
      };

      try {
        const result = await reportCollection.insertOne(reportData);
        res.send(result);
      } catch (error) {
        console.error("Error reporting comment:", error);
        res.status(500).send({ message: "Error reporting comment" });
      }
    });

    // remove downvote
    app.post("/posts/:id/remove-downvote", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await postCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { downvote: -1 } }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error removing downvote" });
      }
    });

    // save comment data
    app.post("/comments", async (req, res) => {
      const commentData = req.body;
      const result = await commentCollection.insertOne(commentData);
      res.send(result);
    });

    // save announcement data
    app.post("/announcements", async (req, res) => {
      const announcement = req.body;
      const result = await announcementCollection.insertOne(announcement);
      res.send(result);
    });

    // users related api
    app.post("/users", async (req, res) => {
      const user = req.body;
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

    // remove data from posts
    app.delete("/posts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postCollection.deleteOne(query);
      res.send(result);
    });

    //delete a report by ID (admin only)
    app.delete("/reports/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      try {
        const result = await reportCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error deleting report" });
      }
    });

    //mark a report as resolved (admin only)
    app.put(
      "/reports/:id/resolve",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const reportId = req.params.id;

        try {
          const query = { _id: new ObjectId(reportId) };
          const updateDoc = {
            $set: { resolved: true },
          };

          const result = await reportCollection.updateOne(query, updateDoc);

          if (result.modifiedCount === 1) {
            res.send({ message: "Report marked as resolved" });
          } else {
            res.status(404).send({ message: "Report not found" });
          }
        } catch (error) {
          console.error("Error marking report as resolved:", error);
          res.status(500).send({ message: "Error marking report as resolved" });
        }
      }
    );

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "amount inside the intent");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    // Save payment and update user membership
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const email = payment.email;

      try {
        const paymentResult = await paymentCollection.insertOne(payment);

        if (paymentResult.insertedId) {
          const filter = { email: email };
          const updateDoc = {
            $set: { membership: "gold" },
          };
          const updateUserResult = await userCollection.updateOne(
            filter,
            updateDoc
          );

          res.send({
            paymentResult,
            updateUserResult,
          });
        } else {
          res.status(500).send({ message: "Failed to save payment" });
        }
      } catch (error) {
        console.error("Error processing payment:", error);
        res.status(500).send({ message: "Error processing payment" });
      }
    });

    // stats or analytics
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const allPosts = await postCollection.estimatedDocumentCount();
      const allComments = await commentCollection.estimatedDocumentCount();
      res.send({
        users,
        allPosts,
        allComments,
      });
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensure that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("synapse is running");
});

app.listen(port, () => {
  console.log(`Synapse forum is running on port ${port}`);
});
