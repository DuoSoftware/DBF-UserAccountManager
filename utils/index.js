module.exports.ValidateParams = (json, required_list) => {
  var miss_list = [];
  for (let x of required_list) {
      if (!json[x]) {
          miss_list.push(x);
      }
  }

  if (miss_list.length > 0) {
      return {status: false, list: miss_list};
  } else {
      return {status: true, list: miss_list};
  }
};

module.exports.Success = (code, message, data) => {
    code = code || 200;

    let obj = {
        code: code,
        message: message,
        status: true
    }

    if (data != undefined) {
        obj['data'] = data;
    }

    return obj;
}

module.exports.Error = (code, message, data) => {
    code = code || 500;

    let obj = {
        code: code,
        status: false,
        message: message
    };

    if (data !== undefined) {
        obj.data = data;
    }

    return obj;
}