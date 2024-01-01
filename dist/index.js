import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
dotenv.config();
if (!process.env.DB_HOST ||
    !process.env.DB_USER ||
    !process.env.DB_PASSWORD ||
    !process.env.DB_NAME) {
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
      sort: EventSortInput
    ): [Event]

    uniqueTags: [String]
  }
`;
const resolvers = {
    Query: {
        events: async (_, { startDate, endDate, dayOfWeek, timeOfDayBefore, timeOfDayAfter, tags, titleContains, venueContains, sort, }) => {
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
                    const sortOrder = sort.order && sort.order.toUpperCase() === "DESC" ? "DESC" : "ASC";
                    query += ` ORDER BY ${mysql.escapeId(sort.field)} ${sortOrder}`;
                }
                const [rows] = await connection.execute(query, params);
                return rows;
            }
            catch (error) {
                throw new Error("Failed to fetch events");
            }
            finally {
                await connection.end();
            }
        },
        uniqueTags: async () => {
            const connection = await connectToDatabase();
            try {
                const query = "SELECT tags FROM events";
                const [rows] = await connection.execute(query);
                // Assert that rows is of type RowDataPacket[]
                const rowDataPackets = rows;
                // Flatten the array of tag strings into a single array of tags
                const allTags = rowDataPackets.flatMap((row) => row.tags.split(",").map((tag) => tag.trim().toLowerCase()));
                // Create a Set to remove duplicates and convert it back to an array
                const uniqueTags = Array.from(new Set(allTags));
                return uniqueTags;
            }
            catch (error) {
                throw new Error("Failed to fetch unique tags");
            }
            finally {
                await connection.end();
            }
        },
    },
};
const server = new ApolloServer({ typeDefs, resolvers });
startStandaloneServer(server, {
    listen: { port: 4000 },
}).then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
});
