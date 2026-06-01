const usernamePattern = /^[A-Za-z][A-Za-z0-9]{3,19}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordPattern = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

const messages = {
  usernameFormat: "Логин должен начинаться с латинской буквы и содержать 4-20 латинских букв или цифр.",
  usernameRequired: "Введите логин.",
  fullNameRequired: "Укажите полное имя.",
  emailInvalid: "Укажите корректный email.",
  passwordFormat: "Пароль должен быть не короче 6 символов и содержать заглавную букву, цифру и спецсимвол.",
  passwordRequired: "Введите пароль.",
};

function validateRegisterForm(values) {
  const errors = {};
  const username = values.username.trim();
  const fullName = values.full_name.trim();
  const email = values.email.trim();
  const password = values.password;

  if (!usernamePattern.test(username)) {
    errors.username = messages.usernameFormat;
  }

  if (!fullName) {
    errors.full_name = messages.fullNameRequired;
  }

  if (!emailPattern.test(email)) {
    errors.email = messages.emailInvalid;
  }

  if (!passwordPattern.test(password)) {
    errors.password = messages.passwordFormat;
  }

  return errors;
}

function validateLoginForm(values) {
  const errors = {};

  if (!values.username.trim()) {
    errors.username = messages.usernameRequired;
  }

  if (!values.password) {
    errors.password = messages.passwordRequired;
  }

  return errors;
}

module.exports = {
  messages,
  validateLoginForm,
  validateRegisterForm,
};
