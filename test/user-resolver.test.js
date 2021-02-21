/* eslint-disable @typescript-eslint/no-var-requires */
const { createTestClient } = require('apollo-server-testing');
const {
  resetDatabase,
  constructTestServer,
  getConnection,
  closeConnection,
} = require('./utils');
const { describe, it, expect } = require('@jest/globals');
const gql = require('graphql-tag');
const { User } = require('../dist/entities/user');

const ME_QUERY = gql`
  query Me {
    me {
      username
      email
    }
  }
`;

describe('me query', () => {
  it('returns null with no session', async () => {
    await resetDatabase();
    const { server } = await constructTestServer({
      context: () => ({
        user: { id: 1, username: 'user' },
        req: { session: {} },
      }),
    });
    const { query } = createTestClient(server);
    const res = await query({ query: ME_QUERY });
    expect(res.data.me).toBe(null);
  });

  it('returns user data for user in session', async () => {
    await resetDatabase();
    const connection = await getConnection();
    await User.create({
      username: 'user',
      password: 'abc123',
      email: 'user@example.com',
    }).save();

    const { server } = await constructTestServer({
      context: () => ({
        user: { id: 1, username: 'user' },
        req: { session: { userId: 1 } },
      }),
    });
    const { query } = createTestClient(server);
    const res = await query({ query: ME_QUERY });
    expect(res.data.me).toEqual({
      username: 'user',
      email: 'user@example.com',
    });
    await closeConnection(connection);
  });
});
