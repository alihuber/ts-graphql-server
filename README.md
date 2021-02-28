## TS-GraphQL-Server

Boilerplate/playground implementation of a GraphQL-Server, written in TypeScript. Uses ApolloServer, Express, Redis, PostgreSQL. Based on [Ben Awad's LiReddit clone](https://github.com/benawad/lireddit), just with fewer database models. Augmented with full server test coverage and logging.

### Setup

- `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `PORT` and `CORS_ORIGIN` should be set trough env
- `docker compose up`
- `yarn watch`
- `yarn dev`
