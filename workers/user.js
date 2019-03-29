const user = require('dbf-dbmodels/Models/RolesAndGroups').user;

module.exports.Create = async (data) => {
  return await user(data).save();
};

module.exports.GetOne = async (context) => {
  return await user.findOne(context);
}

module.exports.UpdateOne = async (context, data) => {
  return await user.findOneAndUpdate(context, data);
}