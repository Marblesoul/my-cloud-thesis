const assert = require("node:assert/strict");
const test = require("node:test");

const {
  validateLoginForm,
  validateRegisterForm,
} = require("./validation.cjs");

test("validateRegisterForm accepts valid registration data", () => {
  const errors = validateRegisterForm({
    username: "User123",
    full_name: "Jane Example",
    email: "jane@example.com",
    password: "Secret1!",
  });

  assert.deepEqual(errors, {});
});

test("validateRegisterForm returns field errors for invalid data", () => {
  const errors = validateRegisterForm({
    username: "1bad",
    full_name: "",
    email: "not-an-email",
    password: "weak",
  });

  assert.equal(errors.username, "Логин должен начинаться с латинской буквы и содержать 4-20 латинских букв или цифр.");
  assert.equal(errors.full_name, "Укажите полное имя.");
  assert.equal(errors.email, "Укажите корректный email.");
  assert.equal(errors.password, "Пароль должен быть не короче 6 символов и содержать заглавную букву, цифру и спецсимвол.");
});

test("validateLoginForm requires username and password", () => {
  const errors = validateLoginForm({
    username: "",
    password: "",
  });

  assert.equal(errors.username, "Введите логин.");
  assert.equal(errors.password, "Введите пароль.");
});
