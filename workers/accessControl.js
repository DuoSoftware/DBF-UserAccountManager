const accessControl = require('dbf-dbmodels/Models/AccessControl').accesscontrol;

module.exports.GetOne = async (context) => {
  return await accessControl.findOne(context);
}

module.exports.GetAll = async () => {
  return await accessControl.find({});
}