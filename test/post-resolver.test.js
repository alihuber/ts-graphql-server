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
const { Post } = require('../dist/entities/post');

const POST_QUERY = gql`
  query Post($id: Int!) {
    post(id: $id) {
      id
      createdAt
      updatedAt
      title
      text
      textSnippet
      creatorId
      creator {
        username
        email
      }
    }
  }
`;

describe('post query', () => {
  it('returns null when no post found', async () => {
    const connection = await getConnection();
    const { server } = await constructTestServer({
      context: () => ({}),
    });
    const { query } = createTestClient(server);

    const res = await query({ query: POST_QUERY, variables: { id: 12 } });

    expect(res.data.post).toBe(null);
    await closeConnection(connection);
  });

  it('returns post with all creator data when own post', async () => {
    await resetDatabase();
    const connection = await getConnection();
    await User.create({
      username: 'user',
      password: 'abc123',
      email: 'user@example.com',
    }).save();
    await Post.create({
      creatorId: 1,
      title: 'post1',
      text: 'text post 1',
    }).save();
    const req = { session: { userId: 1 } };
    const { server } = await constructTestServer({
      context: () => ({
        req,
        userLoader: {
          load: () => {
            return {
              id: 1,
              username: 'user',
              email: 'user@example.com',
            };
          },
        },
      }),
    });
    const { query } = createTestClient(server);

    const res = await query({ query: POST_QUERY, variables: { id: 1 } });

    expect(res.data.post.id).toEqual(1);
    expect(res.data.post.title).toEqual('post1');
    expect(res.data.post.text).toEqual('text post 1');
    expect(res.data.post.textSnippet).toEqual('text post 1');
    expect(res.data.post.creatorId).toEqual(1);
    expect(res.data.post.creator).toEqual({
      username: 'user',
      email: 'user@example.com',
    });
    await closeConnection(connection);
  });

  it('returns post with empty creator email when not own post', async () => {
    await resetDatabase();
    const connection = await getConnection();
    await User.create({
      username: 'user',
      password: 'abc123',
      email: 'user@example.com',
    }).save();
    await User.create({
      username: 'other user',
      password: 'abc123',
      email: 'user2@example.com',
    }).save();
    await Post.create({
      creatorId: 1,
      title: 'post1',
      text: 'text post 1',
    }).save();
    const req = { session: { userId: 2 } };
    const { server } = await constructTestServer({
      context: () => ({
        req,
        userLoader: {
          load: () => {
            return {
              id: 1,
              username: 'user',
              email: 'user@example.com',
            };
          },
        },
      }),
    });
    const { query } = createTestClient(server);

    const res = await query({ query: POST_QUERY, variables: { id: 1 } });

    expect(res.data.post.id).toEqual(1);
    expect(res.data.post.title).toEqual('post1');
    expect(res.data.post.text).toEqual('text post 1');
    expect(res.data.post.textSnippet).toEqual('text post 1');
    expect(res.data.post.creatorId).toEqual(1);
    expect(res.data.post.creator).toEqual({
      username: 'user',
      email: '',
    });
    await closeConnection(connection);
  });
});
