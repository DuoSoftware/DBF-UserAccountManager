const roles = require('dbf-dbmodels/Models/RolesAndGroups').roles;

module.exports.Create = async (data) => {
  return await roles(data).save();
};

module.exports.GetMany = async (context) => {
  return await roles.find(context);
}

module.exports.formatRolePermissions = (roles) => {
  let permissionsObj = {};

  roles.forEach(role => {
    role.permissions.forEach(permission => {
      let pName = permission.permissionName;
      let rulesList = permission.permissionObj;
      if (permissionsObj[pName]) {
        for (const rule in rulesList) {
          if (permissionsObj[pName].hasOwnProperty(rule)) {
            if (!permissionsObj[pName][rule]) {
              permissionsObj[pName][rule] = permission.permissionObj[rule];
            }
          } else {
            permissionsObj[pName][rule] = rulesList[rule];
          }
        }
      } else {
        permissionsObj[pName] = rulesList;
      }
    });
  });

  return permissionsObj;
}