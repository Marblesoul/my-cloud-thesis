const assert = require("node:assert/strict");
const { test } = require("node:test");

const { configureStore } = require("@reduxjs/toolkit");
const { requireTranspiled } = require("../../test-utils/requireTranspiled.cjs");

function makeStore(preloadedUsersState) {
  const usersModule = requireTranspiled("features/users/usersSlice.js");
  return {
    store: configureStore({
      reducer: {
        users: usersModule.default,
      },
      preloadedState: preloadedUsersState
        ? {
            users: {
              action: null,
              error: null,
              items: [],
              status: "idle",
              ...preloadedUsersState,
            },
          }
        : undefined,
    }),
    usersModule,
  };
}

function mockJsonFetch(handler) {
  const calls = [];
  global.document = { cookie: "csrftoken=test-token" };
  global.fetch = async (path, options = {}) => {
    calls.push({ path, options });
    const response = handler(path, options, calls.length);
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => response.body,
      text: async () => JSON.stringify(response.body),
    };
  };
  return calls;
}

test("fetchUsers stores admin user list with statistics", async () => {
  const { store, usersModule } = makeStore();
  const users = [
    {
      id: 1,
      username: "Admin",
      full_name: "Admin User",
      email: "admin@example.com",
      is_admin: true,
      file_count: 3,
      storage_size: 4096,
    },
  ];
  mockJsonFetch((path) => {
    assert.equal(path, "/api/users/");
    return { body: users };
  });

  await store.dispatch(usersModule.fetchUsers()).unwrap();

  assert.deepEqual(store.getState().users.items, users);
});

test("updateUserAdmin replaces the changed user", async () => {
  const { store, usersModule } = makeStore({
    items: [
      { id: 1, username: "Admin", is_admin: true },
      { id: 2, username: "User", is_admin: false },
    ],
  });
  mockJsonFetch((path, options, callNumber) => {
    if (callNumber === 1) {
      assert.equal(path, "/api/csrf/");
      return { body: { detail: "CSRF cookie set." } };
    }

    assert.equal(path, "/api/users/2/");
    assert.equal(options.method, "PATCH");
    return { body: { id: 2, username: "User", is_admin: true } };
  });

  await store.dispatch(usersModule.updateUserAdmin({ userId: 2, isAdmin: true })).unwrap();

  assert.deepEqual(store.getState().users.items, [
    { id: 1, username: "Admin", is_admin: true },
    { id: 2, username: "User", is_admin: true },
  ]);
});

test("deleteUser removes the deleted user from state", async () => {
  const { store, usersModule } = makeStore({
    items: [
      { id: 1, username: "Admin" },
      { id: 2, username: "User" },
    ],
  });
  mockJsonFetch((path, options, callNumber) => {
    if (callNumber === 1) {
      assert.equal(path, "/api/csrf/");
      return { body: { detail: "CSRF cookie set." } };
    }

    assert.equal(path, "/api/users/2/");
    assert.equal(options.method, "DELETE");
    return { body: "" };
  });

  await store.dispatch(usersModule.deleteUser(2)).unwrap();

  assert.deepEqual(store.getState().users.items, [{ id: 1, username: "Admin" }]);
});
