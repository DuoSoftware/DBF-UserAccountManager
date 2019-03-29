const fs = require('fs'),
  jwt = require('jsonwebtoken');

var privateKey = fs.readFileSync(`${__dirname}/keys/private.key`, 'utf8');

module.exports.sign = (payload, opts={}) => {
  // Token signing options
  var signOptions = {
    issuer: opts.issuer || "smoothflow.io",
    subject: opts.subject || "",
    audience: opts.audience || "http://smoothflow.io",
    expiresIn: opts.expiresIn || "30d", // 30 days validity
    algorithm: opts.algorithm || "RS256"
  };

  return jwt.sign(payload, privateKey, signOptions);
}