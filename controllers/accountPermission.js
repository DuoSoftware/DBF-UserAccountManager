const utils = require('../utils'),
  RoleWorker = require('../workers/role'),
  UserWorker = require('../workers/user'),
  AccessControlWorker = require('../workers/accessControl'),
  Token = require('../services/token');

module.exports.get = async (req, res, next) => {
  console.log("UserAccountManager::Get AccountPermissions");

  let authUser = req.user;

  let workspaceId = req.query["workspaceId"] || null;
  let projectId = req.query["projectId"] || null;

  let user = await getUser(authUser.sub);

  if (user) {
    console.log("user data found", user);

    if (workspaceId && !projectId) {
      let workspaceProjects = getProjectsUnderWorkspace(user.projects, workspaceId);

      if (workspaceProjects.length > 0) {
        projectId = workspaceProjects[0]['projectId']; // select first project as default
      }
    }
  
    if (!workspaceId && !projectId) {
      workspaceId = user.tenant || null; // default workspace of user
      projectId = user.company || null; // default project
    }

    console.log(`user trying to access workspace ${workspaceId} and project ${projectId}`);

    if (isUserAllowed2AccessProject(user.projects, workspaceId, projectId)) {
      console.log('user allowed to access requested workspace and project');

      let userRoles = await getAsssignedRolesToUserUnderProject(user.roles, workspaceId, projectId);
      let accessRules = getAccessRules(userRoles);

      let obj = {
        tenant: workspaceId, // currently working workspace id
        company: projectId, // currently working project id
        userName: authUser.sub,
        email: authUser.email,
        permissions: accessRules
      }

      // generate jwt token
      let token = Token.sign(obj);
      console.log('permission token generated');

      res.send(utils.Success(200, "User access list retrived.", token));

    } else {
      res.status(401);
      res.send(utils.Error(401, 
        'User has no permission to access requested workspace/project', undefined));
    }

  } else {
    res.status(204);
    res.send(utils.Error(204, 'No user found.', undefined));
  }
}

const getUser = async (username) => {
  let userData = await UserWorker.GetOne({
      userName: username
    })
    .catch((err) => {
      console.log('Error:: failed to fetch user Data', err);
    });

  return userData;
}

const getAsssignedRolesToUserUnderProject = async (roles, workspaceId, projectId) => {
  let userRoles = [];

  if (roles) {
    let assignedRoleIds = roles.map((role) => {
      if (role.workspaceId == workspaceId &&
        role.projectId == projectId) {
        return role.roleId;
      }
    });

    if (assignedRoleIds.indexOf('all') < 0) {
      userRoles = await RoleWorker.GetMany({
        '_id': {
          $in: assignedRoleIds
        }
      })
      .catch((err) => {
        console.log('Error:: failed to fetch role data', err);
      });
    } else {
      let superUserPermissions = await getSuperUserPermissions();

      let role = {
        roleName: "Super User",
        permissions: superUserPermissions
      }

      userRoles.push(role);
    }

    return userRoles;
  }
}

const getSuperUserPermissions = async () => {
  let permissions = {};

  let accessControls = await AccessControlWorker.GetAll()
    .catch((err) => {
      console.log(err);
    });

  accessControls.forEach(accessControl => {
    if (!permissions[accessControl.permissionName]) {
      permissions[accessControl.permissionName] = {}
    }

    accessControl.permissionObj.forEach(rule => {
      permissions[accessControl.permissionName][rule] = true;
    });
  });

  return permissions;
}

const isUserAllowed2AccessProject = (projects, workspaceId, projectId) => {
  let allowedForAccess = false;

  if (projects) {
    let projCount = projects.length;
    for (let i = 0; i < projCount; i++) {
      if (projects[i]["workspaceId"] == workspaceId &&
        projects[i]["projectId"] == projectId) {

        allowedForAccess = true;
        break;
      }
    }
  }

  return allowedForAccess;
}

const getProjectsUnderWorkspace = (projects, workspaceId) => {
  let workspaceProjects = projects.filter((project) => {
    return (project.workspaceId == workspaceId);
  });

  return workspaceProjects
}

const getAccessRules = (roles) => {
  let accessRules = {};

  roles.forEach(role => {
    if (role.roleName == "Super User") {
      accessRules = role.permissions;
    } else {
      role.permissions.forEach(permission => {
        let pName = permission.permissionName;
        let rulesList = permission.permissionObj;
        if (accessRules[pName]) {
          for (const rule in rulesList) {
            if (accessRules[pName].hasOwnProperty(rule)) {
              if (!accessRules[pName][rule]) {
                accessRules[pName][rule] = permission.permissionObj[rule];
              }
            } else {
              accessRules[pName][rule] = rulesList[rule];
            }
          }
        } else {
          accessRules[pName] = rulesList;
        }
      });
    }
  });

  return accessRules;
}