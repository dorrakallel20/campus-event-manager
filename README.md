# Campus Event Manager

A small NoSQL / MongoDB web application to manage campus events (workshops, talks, meetups,
hackathons), users, and event registrations. Built for the MCS DE1 NoSQL Development Project.

## 1. Purpose

The university needs a lightweight tool to manage campus events: creating events, letting users
register, tracking capacity, and generating activity statistics (most popular events, occupancy,
registrations by category, etc.) directly from MongoDB aggregation pipelines. This instance is
seeded with events and users themed around aivancity's MSc Data Engineering & Cloud Computing
program (courses such as Data Pipelines, LakeHouses, Spark, NoSQL Databases, Data Ethics, and
Advanced Machine Learning).

## 2. Technology used

- **Backend:** Node.js + Express
- **Database:** MongoDB (native `mongodb` driver, no ODM — all queries and pipelines are visible
  directly in `src/routes/*.js`)
- **Views:** EJS server-side templates + Bootstrap 5 (CDN)

## 3. Install dependencies

```bash
npm install
```

## 4. Configure the MongoDB connection

Copy `.env.example` to `.env` and fill in your connection string:

```bash
cp .env.example .env
```

Edit `.env`:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
DB_NAME=campus_events
PORT=3000
```

(Works with either a local MongoDB instance `mongodb://localhost:27017` or a MongoDB Atlas cloud
cluster.)

## 5. Initialize and seed the database

```bash
npm run init-db   # creates indexes (unique users.email, events.startDate, events.category, events.tags) + schema validation
npm run seed      # inserts 15 users, 18 events, 5+ categories, 8+ tags, 60+ registrations
```

Both scripts are idempotent-ish: `seed` clears the `users` and `events` collections before
re-inserting so it can be re-run safely during development.

## 6. Run the application

```bash
npm start
```

Then open **http://localhost:3000**

## 7. Main application pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | Key stats (users, events, upcoming, registrations), next 5 events, most popular event |
| Events | `/events` | Event catalog: search, filter (category / tag / upcoming-past), sort, create/edit/delete |
| Event detail | `/events/:id` | Full event info, participant list, register/cancel a user |
| Users | `/users` | User directory: search, filter, create/edit/delete, registration count |
| User detail | `/users/:id` | Profile + full participation history (upcoming/past) |
| Analytics | `/analytics` | 6 aggregation pipelines: by category, top 5 events, users with no registration, above-average occupancy, most used tags, events by month |

## 8. Author

Dorra Kallel — MSc Data Engineering and Cloud Computing (MSc DE2), aivancity School for Technology, Business & Society, Villejuif.

## 9. Data model notes

- `location` is **embedded** in each event (always accessed together with the event, never queried
  independently → no benefit to referencing it).
- `registrations` is an **embedded array** of sub-documents inside each event (bounded, read
  together with the event on the detail page, and updated atomically with `$push` / `$pull`).
- `organizerId` and `registrations[].userId` are **references** (`ObjectId`) to the `users`
  collection, since users are a large, independently-managed collection reused across many events —
  embedding full user documents would duplicate data and make updates (e.g. a name change)
  inconsistent across events.
