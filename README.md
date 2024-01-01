# GraphQL Events API

This API interfaces with the Juilcal MySQL database to provide information about events and allows various queries with different filters.

## Environment Setup

Before running the application, ensure the following environment variables are set in your `.env` file:

- `DB_HOST`: The hostname of your database server.
- `DB_USER`: The user for your database.
- `DB_PASSWORD`: The password for your database user.
- `DB_NAME`: The name of your database.

## Running the Server

To start the server, run your Node.js application. Ensure all dependencies are installed. The server will start on the specified port (default is 4000), and you should see a message indicating that the server is running.

## API Queries

The GraphQL schema provides the following queries:

### Events Query

Fetches events based on the provided filters.

**Arguments:**

- `dayOfWeek`: Filters events by the day of the week.
- `timeBefore`: Filters events that occur before a specific time.
- `timeAfter`: Filters events that occur after a specific time.
- `tags`: Filters events by tags.
- `titleContains`: Filters events whose title contains the specified string.
- `sort`: Sorts the results based on a field and order.

**Example Query:**

```graphql
query {
  events(dayOfWeek: "Friday", tags: ["music"]) {
    title
    date_time
    venue
    link
    tags
  }
}
