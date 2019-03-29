const project = require('dbf-dbmodels/Models/RolesAndGroups').project,
  IDGenerator = require('../services/idGenerator');

module.exports.Create = async (data) => {
  let projectId = await IDGenerator.get('project').catch((err) => {});
  data['company'] = projectId;
  
  return await project(data).save();
};

module.exports.GetOne = async (context) => {
  return await project.findOne(context);
}

module.exports.GetMany = async (context) => {
  return await project.find(context);
}

module.exports.UpdateOne = async (context, data) => {
  return await project.findOneAndUpdate(context, data);
}