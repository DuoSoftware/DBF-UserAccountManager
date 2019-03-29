const workspace = require('dbf-dbmodels/Models/RolesAndGroups').workspace,
  IDGenerator = require('../services/idGenerator');

module.exports.Create = async (data) => {
  let workspaceId = await IDGenerator.get('workspace').catch((err) => {});
  data['tenant'] = workspaceId;
  
  return await workspace(data).save();
};

module.exports.GetOne = async (context) => {
  return await workspace.findOne(context);
}

module.exports.UpdateOne = async (context, data) => {
  return await workspace.findOneAndUpdate(context, data);
}