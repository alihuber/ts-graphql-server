import 'reflect-metadata';
import 'dotenv-safe/config';
import { COOKIE_NAME, __prod__ } from './constants';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageDisabled,
} from 'apollo-server-core';
import { buildSchema } from 'type-graphql';
import Redis from 'ioredis';
import session from 'express-session';
import connectRedis from 'connect-redis';
import cors from 'cors';
import { createPrometheusExporterPlugin } from '@bmatei/apollo-prometheus-exporter';
import Prometheus from 'prom-client';
import { PostResolver } from './resolvers/post';
import { AuthResolver } from './resolvers/auth';
import { AdminUserResolver } from './resolvers/adminUsers';
import { MyContext } from './types';
import { createUserLoader } from './utils/createUserLoader';
import { getLogger } from './utils/Logger';
import { AppDataSource } from './data-source';

const logger = getLogger('Server');

const register = new Prometheus.Registry();

register.setDefaultLabels({
  app: 'ts-graphql-server',
});

Prometheus.collectDefaultMetrics({ register });

const main = async () => {
  const conn = await AppDataSource.initialize();
  const app = express();
  conn.runMigrations();

  const prometheusExporterPlugin = createPrometheusExporterPlugin({
    app,
    register,
    defaultMetrics: true,
    metricsEndpointPath: '/metrics',
  });

  const RedisStore = connectRedis(session);
  const redis = new Redis(process.env.REDIS_URL);
  // to get cookies to work: tell express we're behind a proxy
  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: [process.env.CORS_ORIGIN, process.env.MOBILE_CORS_ORIGIN],
      credentials: true,
    })
  );
  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({ client: redis, disableTouch: true }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        httpOnly: true,
        secure: __prod__,
        sameSite: 'lax', // csrf
        // TODO: real domain
        domain: __prod__ ? '.real.com' : '192.168.0.13',
      },
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
    })
  );

  app.get('/metrics', (_, res) => {
    res.setHeader('Content-Type', register.contentType);
    res.end(register.metrics());
  });
  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [PostResolver, AuthResolver, AdminUserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({
      req,
      res,
      redis,
      userLoader: createUserLoader(),
    }),
    plugins: [
      prometheusExporterPlugin,
      process.env.NODE_ENV === 'production'
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
  });
  await apolloServer.start();
  apolloServer.applyMiddleware({ app, cors: false });
  app.listen(parseInt(process.env.PORT, 10), () => {
    logger.info({
      message: `server started on port ${process.env.PORT}`,
    });
  });
};

main();
