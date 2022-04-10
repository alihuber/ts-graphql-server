/* eslint-disable @typescript-eslint/no-var-requires */
const { createTestClient } = require('apollo-server-testing');
const {
  resetDatabase,
  constructTestServer,
  getConnection,
  closeConnection,
  getPostFactory,
} = require('./utils');
const { beforeEach, describe, it, expect } = require('@jest/globals');
const gql = require('graphql-tag');
const { User } = require('../dist/entities/user');
const { Post } = require('../dist/entities/post');
const {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  PostInput,
} = require('../dist/resolvers/PostInput');

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

const POSTS_QUERY = gql`
  query Posts($limit: Int!, $cursor: String) {
    posts(limit: $limit, cursor: $cursor) {
      hasMore
      posts {
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
  }
`;

const CREATE_POST_MUTATION = gql`
  mutation CreatePost($input: PostInput!) {
    createPost(input: $input) {
      id
      createdAt
      updatedAt
      title
      text
      creatorId
    }
  }
`;

const UPDATE_POST_MUTATION = gql`
  mutation UpdatePost($id: Int!, $title: String!, $text: String!) {
    updatePost(id: $id, title: $title, text: $text) {
      id
      title
      text
      textSnippet
    }
  }
`;

const DELETE_POST_MUTATION = gql`
  mutation DeletePost($id: Int!) {
    deletePost(id: $id)
  }
`;

beforeEach(async () => {
  await resetDatabase();
});

describe('posts query with no posts, no cursor', () => {
  it('returns empty array', async () => {
    const connection = await getConnection();
    const { server } = await constructTestServer({
      context: () => ({}),
    });
    const { query } = createTestClient(server);

    const res = await query({ query: POSTS_QUERY, variables: { limit: 20 } });

    expect(res.data.posts).toEqual({ hasMore: false, posts: [] });
    await closeConnection(connection);
  });
});

describe('posts query with no more posts, no cursor', () => {
  it('returns limit length posts, hasMore', async () => {
    const connection = await getConnection();
    await User.create({
      username: 'user',
      password: 'abc123',
      email: 'user@example.com',
      admin: false,
    }).save();
    const postFactory = getPostFactory();
    for (let i = 0; i < 20; i++) {
      const builtPost = postFactory.build();
      await Post.create(builtPost).save();
    }
    const { server } = await constructTestServer({
      context: () => ({
        req: { session: {} },
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

    const res = await query({ query: POSTS_QUERY, variables: { limit: 20 } });
    expect(res.data.posts.hasMore).toBe(false);
    expect(res.data.posts.posts.length).toBe(20);
    await closeConnection(connection);
  });
});

describe('posts query with has more posts, no cursor', () => {
  it('returns limit length posts, hasMore', async () => {
    const connection = await getConnection();
    await User.create({
      username: 'user',
      password: 'abc123',
      email: 'user@example.com',
      admin: false,
    }).save();
    const postFactory = getPostFactory();
    for (let i = 0; i < 21; i++) {
      const builtPost = postFactory.build();
      await Post.create(builtPost).save();
    }
    const { server } = await constructTestServer({
      context: () => ({
        req: { session: {} },
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

    const res = await query({ query: POSTS_QUERY, variables: { limit: 20 } });
    expect(res.data.posts.hasMore).toBe(true);
    expect(res.data.posts.posts.length).toBe(20);
    await closeConnection(connection);
  });
});

describe('posts query with has more posts, with cursor', () => {
  it('returns cursor limited posts', async () => {
    const connection = await getConnection();
    await User.create({
      username: 'user',
      password: 'abc123',
      email: 'user@example.com',
      admin: false,
    }).save();
    const postFactory = getPostFactory();
    for (let i = 0; i < 21; i++) {
      const builtPost = postFactory.build();
      await Post.create(builtPost).save();
    }
    const { server } = await constructTestServer({
      context: () => ({
        req: { session: {} },
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

    const res1 = await query({ query: POSTS_QUERY, variables: { limit: 20 } });
    expect(res1.data.posts.hasMore).toBe(true);
    expect(res1.data.posts.posts.length).toBe(20);
    const cursor = new Date(
      parseInt(
        res1.data.posts.posts[res1.data.posts.posts.length - 1].createdAt,
        10
      )
    ).toISOString();
    const res2 = await query({
      query: POSTS_QUERY,
      variables: { limit: 20, cursor },
    });
    expect(res2.data.posts.hasMore).toBe(false);
    expect(res2.data.posts.posts.length).toBe(1);
    await closeConnection(connection);
  });
});

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
    const connection = await getConnection();
    await User.create({
      username: 'user',
      password: 'abc123',
      email: 'user@example.com',
      admin: false,
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
    const connection = await getConnection();
    await User.create({
      username: 'user',
      password: 'abc123',
      email: 'user@example.com',
      admin: false,
    }).save();
    await User.create({
      username: 'other user',
      password: 'abc123',
      email: 'user2@example.com',
      admin: false,
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
      email: 'user@example.com',
    });
    await closeConnection(connection);
  });
});

describe('create post mutation', () => {
  it('returns not authenticated error with no session', async () => {
    const connection = await getConnection();
    const { server } = await constructTestServer({
      context: () => ({
        req: { session: {} },
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: CREATE_POST_MUTATION,
      variables: {
        input: {
          title: 'new post',
          text: 'some text',
        },
      },
    });

    expect(res.errors[0].message).toEqual('not authenticated');
    await closeConnection(connection);
  });

  it('creates new post', async () => {
    const connection = await getConnection();
    const { server } = await constructTestServer({
      context: () => ({
        req: { session: { userId: 1 } },
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: CREATE_POST_MUTATION,
      variables: {
        input: {
          title: 'new post',
          text: 'some text',
        },
      },
    });

    expect(res.data.createPost.id).toEqual(1);
    expect(res.data.createPost.title).toEqual('new post');
    expect(res.data.createPost.text).toEqual('some text');
    await closeConnection(connection);
  });
});

describe('update post mutation', () => {
  it('returns not authenticated error with no session', async () => {
    const connection = await getConnection();
    const { server } = await constructTestServer({
      context: () => ({
        req: { session: {} },
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: UPDATE_POST_MUTATION,
      variables: {
        id: 1,
        title: 'new post',
        text: 'some text',
      },
    });

    expect(res.errors[0].message).toEqual('not authenticated');
    await closeConnection(connection);
  });

  it('returns null when post not found', async () => {
    const connection = await getConnection();
    const { server } = await constructTestServer({
      context: () => ({
        req: { session: { userId: 1 } },
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: UPDATE_POST_MUTATION,
      variables: {
        id: 2,
        title: 'new post',
        text: 'some text',
      },
    });

    expect(res.data.updatePost).toBe(null);
    await closeConnection(connection);
  });

  it('updates post', async () => {
    const connection = await getConnection();
    await Post.create({
      creatorId: 1,
      title: 'post1',
      text: 'text post 1',
    }).save();
    const { server } = await constructTestServer({
      context: () => ({
        req: { session: { userId: 1 } },
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: UPDATE_POST_MUTATION,
      variables: {
        id: 1,
        title: 'updated post',
        text: 'some text',
      },
    });

    expect(res.data.updatePost.title).toEqual('updated post');
    expect(res.data.updatePost.text).toEqual('some text');
    await closeConnection(connection);
  });
});

describe('delete post mutation', () => {
  it('returns not authenticated error with no session', async () => {
    const connection = await getConnection();
    const { server } = await constructTestServer({
      context: () => ({
        req: { session: {} },
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: DELETE_POST_MUTATION,
      variables: {
        id: 1,
      },
    });

    expect(res.errors[0].message).toEqual('not authenticated');
    await closeConnection(connection);
  });

  it('returns false when post not found', async () => {
    const connection = await getConnection();
    const { server } = await constructTestServer({
      context: () => ({
        req: { session: { userId: 1 } },
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: DELETE_POST_MUTATION,
      variables: {
        id: 1,
      },
    });

    expect(res.data.deletePost).toBe(false);
    await closeConnection(connection);
  });

  it('returns error when user wants to delete other users post', async () => {
    const connection = await getConnection();
    await Post.create({
      creatorId: 2,
      title: 'post1',
      text: 'text post 1',
    }).save();
    const { server } = await constructTestServer({
      context: () => ({
        req: { session: { userId: 1 } },
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: DELETE_POST_MUTATION,
      variables: {
        id: 1,
      },
    });

    expect(res.errors[0].message).toEqual('not authorized');
    await closeConnection(connection);
  });

  it('returns true when deleted', async () => {
    const connection = await getConnection();
    await User.create({
      username: 'user',
      password: 'abc123',
      email: 'user@example.com',
      admin: false,
    }).save();
    await Post.create({
      creatorId: 1,
      title: 'post1',
      text: 'text post 1',
    }).save();
    const { server } = await constructTestServer({
      context: () => ({
        req: { session: { userId: 1 } },
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: DELETE_POST_MUTATION,
      variables: {
        id: 1,
      },
    });

    expect(res.data.deletePost).toBe(true);
    await closeConnection(connection);
  });
});
