/* eslint-disable @typescript-eslint/no-var-requires, no-console */
const path = require('path');
require('dotenv-safe').config({
  path: './.env.test',
});
require('reflect-metadata');
const { ApolloServer } = require('apollo-server-express');
const { buildSchema } = require('type-graphql');
const { Table, DataSource } = require('typeorm');
const { PostResolver } = require('../dist/resolvers/post');
const { UserResolver } = require('../dist/resolvers/user');
const { User } = require('../dist/entities/user');
const { Post } = require('../dist/entities/post');
const Factory = require('rosie').Factory;

const constructTestServer = async ({ context }) => {
  const server = new ApolloServer({
    schema: await buildSchema({
      resolvers: [PostResolver, UserResolver],
      validate: false,
    }),
    context,
  });
  return { server };
};

const getConnection = async () => {
  const AppDataSource = new DataSource(require('../ormconfig.json'));
  const conn = await AppDataSource.initialize();
  conn.setOptions({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    // logging: true,
    entities: [User, Post],
    migrations: [path.join(__dirname, '../dist/migrations/*')],
  });
  return conn;
};

const closeConnection = async (connection) => {
  await connection.close();
};

const resetDatabase = async () => {
  const conn = await getConnection();
  const queryRunner = await conn.createQueryRunner();
  try {
    await queryRunner.dropTable('post');
  } catch (e) {
    console.log('table post not found, not dropping...');
  }
  try {
    await queryRunner.dropTable('user');
  } catch (e) {
    console.log('table user not found, not dropping...');
  }
  await queryRunner.createTable(
    new Table({
      name: 'user',
      columns: [
        {
          name: 'id',
          type: 'int',
          isPrimary: true,
          isGenerated: true,
          generationStrategy: 'increment',
        },
        {
          name: 'createdAt',
          type: 'timestamp',
          default: 'now()',
        },
        {
          name: 'updatedAt',
          type: 'timestamp',
          default: 'now()',
        },
        {
          name: 'username',
          type: 'varchar',
          isUnique: 'true',
        },
        {
          name: 'email',
          type: 'varchar',
          isUnique: 'true',
        },
        {
          name: 'password',
          type: 'varchar',
        },
      ],
    }),
    true
  );
  await queryRunner.createTable(
    new Table({
      name: 'post',
      columns: [
        {
          name: 'id',
          type: 'int',
          isPrimary: true,
          isGenerated: true,
          generationStrategy: 'increment',
        },
        {
          name: 'createdAt',
          type: 'timestamp',
          default: 'now()',
        },
        {
          name: 'updatedAt',
          type: 'timestamp',
          default: 'now()',
        },
        {
          name: 'title',
          type: 'varchar',
        },
        {
          name: 'text',
          type: 'varchar',
        },
        {
          name: 'creatorId',
          type: 'int',
        },
      ],
    }),
    true
  );
  await conn.runMigrations();
  await conn.close();
};

const randomDate = (start, end) => {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
};

const getPostFactory = () => {
  return new Factory()
    .sequence('id')
    .attr('createdAt', () => {
      return randomDate(new Date('2020', '0'), new Date());
    })
    .attr('updatedAt', () => {
      return new Date();
    })
    .sequence('title', function (i) {
      return `Post no. ${i}`;
    })
    .sequence('text', function (i) {
      return `Text for post no. ${i}`;
    })
    .attr('creatorId', 1);
};

module.exports = {
  resetDatabase,
  constructTestServer,
  getConnection,
  closeConnection,
  getPostFactory,
};
