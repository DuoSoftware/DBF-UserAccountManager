const cognito = require('./cognito');

module.exports = function (options) {
  return (req, res, next) => {
    cognito
      .ValidateToken(req)
      .then((result) => {
        req["user"] = result;
        next();
      })
      .catch((err) => {
        next(err);
      });
  };
};