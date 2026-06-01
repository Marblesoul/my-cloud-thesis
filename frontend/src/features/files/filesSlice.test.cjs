const assert = require("node:assert/strict");
const { test } = require("node:test");

const { configureStore } = require("@reduxjs/toolkit");
const { requireTranspiled } = require("../../test-utils/requireTranspiled.cjs");

function makeStore(preloadedFilesState) {
  const filesModule = requireTranspiled("features/files/filesSlice.js");
  return {
    filesModule,
    store: configureStore({
      reducer: {
        files: filesModule.default,
      },
      preloadedState: preloadedFilesState
        ? {
            files: {
              action: null,
              currentUserId: null,
              error: null,
              fieldErrors: {},
              items: [],
              sharedUrls: {},
              status: "idle",
              ...preloadedFilesState,
            },
          }
        : undefined,
    }),
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

test("fetchFiles loads another storage when userId is provided", async () => {
  const { filesModule, store } = makeStore();
  const remoteFiles = [
    {
      id: 7,
      original_name: "report.pdf",
      size: 1024,
      comment: "Quarter report",
      uploaded_at: "2026-01-01T12:00:00Z",
      last_download_at: null,
    },
  ];
  const calls = mockJsonFetch((path) => {
    assert.equal(path, "/api/files/?user_id=42");
    return { body: remoteFiles };
  });

  await store.dispatch(filesModule.fetchFiles({ userId: 42 })).unwrap();

  assert.equal(calls.length, 1);
  assert.deepEqual(store.getState().files.items, remoteFiles);
  assert.equal(store.getState().files.currentUserId, 42);
});

test("uploadFile posts multipart data to the selected storage", async () => {
  const { filesModule, store } = makeStore();
  const uploadedFile = {
    id: 8,
    original_name: "upload.txt",
    size: 5,
    comment: "Admin upload",
    uploaded_at: "2026-01-01T12:00:00Z",
    last_download_at: null,
  };
  const calls = mockJsonFetch((path, options, callNumber) => {
    if (callNumber === 1) {
      assert.equal(path, "/api/csrf/");
      return { body: { detail: "CSRF cookie set." } };
    }

    assert.equal(path, "/api/files/?user_id=42");
    assert.equal(options.method, "POST");
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get("comment"), "Admin upload");
    return { body: uploadedFile, status: 201 };
  });

  await store
    .dispatch(
      filesModule.uploadFile({
        comment: "Admin upload",
        file: new Blob(["hello"], { type: "text/plain" }),
        userId: 42,
      }),
    )
    .unwrap();

  assert.equal(calls.length, 2);
  assert.deepEqual(store.getState().files.items, [uploadedFile]);
});

test("shareFile stores a public URL by file id", async () => {
  const { filesModule, store } = makeStore();
  const calls = mockJsonFetch((path, options, callNumber) => {
    if (callNumber === 1) {
      assert.equal(path, "/api/csrf/");
      return { body: { detail: "CSRF cookie set." } };
    }

    assert.equal(path, "/api/files/7/share/");
    assert.equal(options.method, "POST");
    return {
      body: {
        shared_token: "token",
        shared_path: "/api/shared/token/",
        shared_url: "http://testserver/api/shared/token/",
      },
    };
  });

  await store.dispatch(filesModule.shareFile(7)).unwrap();

  assert.equal(calls.length, 2);
  assert.equal(store.getState().files.sharedUrls[7], "http://testserver/api/shared/token/");
});

test("deleteFile removes the deleted item from state", async () => {
  const { filesModule, store } = makeStore({
    items: [
      { id: 1, original_name: "keep.txt" },
      { id: 2, original_name: "remove.txt" },
    ],
  });
  mockJsonFetch((path, options, callNumber) => {
    if (callNumber === 1) {
      assert.equal(path, "/api/csrf/");
      return { body: { detail: "CSRF cookie set." } };
    }

    assert.equal(path, "/api/files/2/");
    assert.equal(options.method, "DELETE");
    return { body: "" };
  });

  await store.dispatch(filesModule.deleteFile(2)).unwrap();

  assert.deepEqual(
    store.getState().files.items.map((item) => item.id),
    [1],
  );
});
