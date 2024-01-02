import dotenv from "dotenv";
import mysql, { RowDataPacket } from "mysql2/promise";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

dotenv.config();

if (
  !process.env.DB_HOST ||
  !process.env.DB_USER ||
  !process.env.DB_PASSWORD ||
  !process.env.DB_NAME
) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

async function connectToDatabase() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

const typeDefs = `
  type Event {
    title: String
    date_time: String
    venue: String
    link: String
    tags: String
    last_updated: String
  }

  type Venue {
    venue: String
  }

  input EventSortInput {
    field: String
    order: String
  }

  type Query {
    events(
      startDate: String,
      endDate: String,
      dayOfWeek: String,
      timeOfDayBefore: String,
      timeOfDayAfter: String,
      tags: [String],
      titleContains: String,
      venueContains: String,
      sort: EventSortInput,
      limit: Int,         
      offset: Int
    ): [Event]

    uniqueTags: [String]

    lastUpdated: String

    distinctVenues: [Venue]
  }
`;

const resolvers = {
  Query: {
    events: async (
      _,
      {
        startDate,
        endDate,
        dayOfWeek,
        timeOfDayBefore,
        timeOfDayAfter,
        tags,
        titleContains,
        venueContains,
        sort,
        limit,
        offset,
      }
    ) => {
      const connection = await connectToDatabase();
      try {
        let query = "SELECT * FROM events WHERE 1=1";
        const params = [];

        if (titleContains) {
          query += " AND title LIKE ?";
          params.push(`%${titleContains}%`);
        }

        if (startDate) {
          query += " AND DATE(date_time) >= ?";
          params.push(startDate);
        }

        if (endDate) {
          query += " AND DATE(date_time) <= ?";
          params.push(endDate);
        }

        if (dayOfWeek) {
          query += " AND DAYNAME(date_time) = ?";
          params.push(dayOfWeek);
        }

        if (timeOfDayBefore) {
          query += " AND TIME(date_time) <= ?";
          params.push(timeOfDayBefore);
        }

        if (timeOfDayAfter) {
          query += " AND TIME(date_time) >= ?";
          params.push(timeOfDayAfter);
        }

        if (venueContains) {
          query += " AND venue LIKE ?";
          params.push(`%${venueContains}%`);
        }

        if (tags && tags.length > 0) {
          // Convert both database tags and input tags to lowercase for case-insensitive comparison
          const tagConditions = tags
            .map((tag) => `FIND_IN_SET(LOWER(?), LOWER(tags)) > 0`)
            .join(" OR ");
          query += ` AND (${tagConditions})`;
          params.push(...tags.map((tag) => tag.trim().toLowerCase())); // Lowercase and trim each tag
        }

        const validSortFields = ["date_time"];

        if (sort && sort.field) {
          if (!validSortFields.includes(sort.field)) {
            throw new Error("Invalid sort field");
          }

          const sortOrder =
            sort.order && sort.order.toUpperCase() === "DESC" ? "DESC" : "ASC";
          query += ` ORDER BY ${mysql.escapeId(sort.field)} ${sortOrder}`;
        }

        if (typeof limit === "number" && limit > 0) {
          query += " LIMIT ?";
          params.push(`${limit}`);
        }

        if (typeof offset === "number" && offset > 0) {
          query += " OFFSET ?";
          params.push(`${offset}`);
        }

        const [rows] = await connection.execute(query, params);
        return rows;
      } catch (error) {
        console.error("Error executing query:", error);
        throw new Error("Failed to fetch events");
      } finally {
        await connection.end();
      }
    },

    uniqueTags: async () => {
      const connection = await connectToDatabase();
      try {
        const query = "SELECT tags FROM events";
        const [rows] = await connection.execute(query);
        const rowDataPackets = rows as mysql.RowDataPacket[];
        const allTags = rowDataPackets.flatMap((row) =>
          row.tags.split(",").map((tag) => tag.trim().toLowerCase())
        );
        const uniqueTags = Array.from(new Set(allTags));
        return uniqueTags;
      } catch (error) {
        throw new Error("Failed to fetch unique tags");
      } finally {
        await connection.end();
      }
    },

    distinctVenues: async () => {
      const connection = await connectToDatabase();
      try {
        const query = "SELECT DISTINCT venue FROM events";
        const [rows] = (await (connection.execute(query) as unknown)) as [
          RowDataPacket[]
        ];
        return rows.map((row) => ({ venue: row.venue }));
      } catch (error) {
        console.error("Error executing query:", error);
        throw new Error("Failed to fetch distinct venues");
      } finally {
        await connection.end();
      }
    },

    lastUpdated: async () => {
      const connection = await connectToDatabase();
      try {
        const query = "SELECT MAX(last_updated) AS last_updated FROM events";
        const [rows] = (await (connection.execute(query) as unknown)) as [
          RowDataPacket[]
        ];
        if (rows.length > 0) {
          return rows[0].last_updated;
        }
        return null;
      } catch (error) {
        console.error("Error fetching last_updated:", error);
        throw new Error("Failed to fetch last_updated");
      } finally {
        await connection.end();
      }
    },
  },
};

const server = new ApolloServer({ typeDefs, resolvers });
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

startStandaloneServer(server, {
  listen: { port: PORT }, // Listen on the dynamically assigned Heroku port
}).then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
