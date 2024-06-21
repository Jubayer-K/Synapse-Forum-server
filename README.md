# Synapse Forum Backend

The Synapse Forum backend is built using Node.js, Express, and MongoDB. It provides RESTful APIs for managing posts, users, comments, tags, announcements, and reports. It also includes authentication with JWT, admin verification, and integration with Stripe for payment processing.

## Features

- **User Authentication**: 
  - Generate JWT tokens for user authentication.
  - Middleware to verify JWT tokens.
  - Middleware to verify admin privileges.
  
- **User Management**:
  - Get all users (admin only).
  - Check if a user is an admin.
  - Promote a user to admin.
  - Register new users.

- **Posts Management**:
  - Get all posts with pagination and optional tag filtering.
  - Get popular posts based on upvotes and downvotes.
  - Get a single post by ID.
  - Get posts by user email.
  - Create new posts.
  - Delete a post by ID.
  - Upvote and downvote posts.
  - Remove upvote and downvote.

- **Comments Management**:
  - Get all comments.
  - Get comments by post ID.
  - Get comments by post title.
  - Get a single comment by ID.
  - Create new comments.

- **Tags Management**:
  - Get all tags.
  - Create new tags.

- **Announcements Management**:
  - Get all announcements.
  - Create new announcements.

- **Reports Management**:
  - Get all reports.
  - Report a comment.
  - Delete a report (admin only).
  - Mark a report as resolved (admin only).

- **Payments**:
  - Create a Stripe payment intent.
  - Save payment information and update user membership status.
  - Get payment information by user email.

- **Admin Analytics**:
  - Get stats for total users, posts, and comments (admin only).

## Technologies Used

- **Node.js**: Runtime environment for executing JavaScript on the server.
- **Express.js**: Web framework for building RESTful APIs.
- **MongoDB**: NoSQL database for storing user, post, comment, tag, announcement, and report data.
- **Mongoose**: ODM library for MongoDB.
- **jsonwebtoken**: Library for generating and verifying JSON Web Tokens (JWT).
- **dotenv**: Module to load environment variables from a .env file.
- **cors**: Middleware to enable Cross-Origin Resource Sharing (CORS).
- **Stripe**: Payment processing platform.

