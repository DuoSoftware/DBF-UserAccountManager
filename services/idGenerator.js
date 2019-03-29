const request = require("request");

module.exports.get = (context) => {
  return new Promise((resolve, reject) => {
    request({ 
      url: `https://smoothiddev.plus.smoothflow.io/DBF/IDService/main/${context}`,
      json: true
    }, function (err, config, body) {
      if (err) {
        reject(err);
      }

      resolve(parseInt(body));
    });
  });
}