/* eslint-disable @typescript-eslint/no-var-requires, no-console */
const path = require('path');
require('dotenv-safe').config({
  path: './.env.test',
});
require('reflect-metadata');
const { ApolloServer } = require('apollo-server-express');
const { buildSchema } = require('type-graphql');
const { createConnection, Table } = require('typeorm');
const { PostResolver } = require('../dist/resolvers/post');
const { UserResolver } = require('../dist/resolvers/user');
const { User } = require('../dist/entities/user');
const { Post } = require('../dist/entities/post');

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
  return await createConnection({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    // logging: true,
    entities: [User, Post],
    migrations: [path.join(__dirname, '../dist/migrations/*')],
  });
};

const closeConnection = async (connection) => {
  await connection.close();
};

const resetDatabase = async () => {
  const conn = await createConnection({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    // logging: true,
    entities: [User, Post],
    migrations: [path.join(__dirname, '../dist/migrations/*')],
  });
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
        },
        {
          name: 'email',
          type: 'varchar',
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

module.exports = {
  resetDatabase,
  constructTestServer,
  getConnection,
  closeConnection,
};
