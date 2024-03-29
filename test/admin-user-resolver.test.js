/* eslint-disable @typescript-eslint/no-var-requires */
const { createTestClient } = require('apollo-server-testing');
const {
  resetDatabase,
  constructTestServer,
  getConnection,
  closeConnection,
  getUserFactory,
} = require('./utils');
const { beforeEach, describe, it, expect } = require('@jest/globals');
const gql = require('graphql-tag');
const { User } = require('../dist/entities/user');

const USERS_QUERY = gql`
  query Users($limit: Int!, $cursor: String) {
    users(limit: $limit, cursor: $cursor) {
      hasMore
      users {
        id
        username
      }
    }
  }
`;

const USER_QUERY = gql`
  query User($userId: Int!) {
    user(userId: $userId) {
      id
      username
      admin
      email
    }
  }
`;

beforeEach(async () => {
  await resetDatabase();
});

describe('admin users query', () => {
  it('returns error with no session', async () => {
    const connection = await getConnection();
    const { server } = await constructTestServer({
      context: () => ({
        user: { id: 1, username: 'user' },
        req: { session: {} },
      }),
    });
    const { query } = createTestClient(server);

    const res = await query({ query: USERS_QUERY, variables: { limit: 20 } });
    expect(res.errors[0].message).toEqual('not authenticated');
    await closeConnection(connection);
  });

  it('returns error with non-admin user in session', async () => {
    const connection = await getConnection();
    const userFactory = getUserFactory();
    const builtUser = userFactory.build();
    const user = await User.create(builtUser).save();
    const { server } = await constructTestServer({
      context: () => ({
        user: { id: 1, username: 'user' },
        req: { session: { userId: user.id } },
      }),
    });
    const { query } = createTestClient(server);

    const res = await query({ query: USERS_QUERY, variables: { limit: 20 } });
    expect(res.errors[0].message).toEqual('not authenticated');
    await closeConnection(connection);
  });

  it('returns users with admin user in session', async () => {
    const connection = await getConnection();
    await User.create({
      username: 'user',
      password: 'abc123',
      email: 'user@example.com',
      admin: false,
    }).save();
    const adminUser = await User.create({
      username: 'admin',
      password: 'adminadmin',
      email: 'admin@example.com',
      admin: true,
    }).save();
    const { server } = await constructTestServer({
      context: () => ({
        user: { id: 2, username: 'admin' },
        req: { session: { userId: adminUser.id } },
      }),
    });
    const { query } = createTestClient(server);

    const res = await query({ query: USERS_QUERY, variables: { limit: 20 } });
    expect(res.errors).toBe(undefined);
    expect(res.data.users.users.length).toBe(2);
    expect(res.data.users.hasMore).toBe(false);
    await closeConnection(connection);
  });

  // TODO: pagination tests etc
});

describe('admin user query', () => {
  it('returns error with no session', async () => {
    const connection = await getConnection();
    const { server } = await constructTestServer({
      context: () => ({
        user: { id: 1, username: 'user' },
        req: { session: {} },
      }),
    });
    const { query } = createTestClient(server);

    const res = await query({ query: USER_QUERY, variables: { userId: 1 } });
    expect(res.errors[0].message).toEqual('not authenticated');
    await closeConnection(connection);
  });

  it('returns error with non-admin user in session', async () => {
    const connection = await getConnection();
    const userFactory = getUserFactory();
    const builtUser = userFactory.build();
    const user = await User.create(builtUser).save();
    const { server } = await constructTestServer({
      context: () => ({
        user: { id: 1, username: 'user' },
        req: { session: { userId: user.id } },
      }),
    });
    const { query } = createTestClient(server);

    const res = await query({ query: USER_QUERY, variables: { userId: 1 } });
    expect(res.errors[0].message).toEqual('not authenticated');
    await closeConnection(connection);
  });

  it('returns user data with admin user in session', async () => {
    const connection = await getConnection();
    await User.create({
      username: 'user',
      password: 'abc123',
      email: 'user@example.com',
      admin: false,
    }).save();
    const adminUser = await User.create({
      username: 'admin',
      password: 'adminadmin',
      email: 'admin@example.com',
      admin: true,
    }).save();
    const { server } = await constructTestServer({
      context: () => ({
        user: { id: 2, username: 'admin' },
        req: { session: { userId: adminUser.id } },
      }),
    });
    const { query } = createTestClient(server);

    const res = await query({ query: USER_QUERY, variables: { userId: 1 } });
    expect(res.errors).toBe(undefined);
    expect(res.data.user.username).toEqual('user');
    expect(res.data.user.password).toBe(undefined);
    expect(res.data.user.email).toEqual('user@example.com');
    expect(res.data.user.admin).toBe(false);
    await closeConnection(connection);
  });

  it('returns no user data when no user found', async () => {
    const connection = await getConnection();
    const adminUser = await User.create({
      username: 'admin',
      password: 'adminadmin',
      email: 'admin@example.com',
      admin: true,
    }).save();
    const { server } = await constructTestServer({
      context: () => ({
        user: { id: 2, username: 'admin' },
        req: { session: { userId: adminUser.id } },
      }),
    });
    const { query } = createTestClient(server);

    const res = await query({ query: USER_QUERY, variables: { userId: 12 } });
    expect(res.errors).toBe(undefined);
    expect(res.data.user).toBeNull();
    await closeConnection(connection);
  });
});
