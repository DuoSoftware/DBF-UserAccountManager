const utils = require('../utils'),
  WorkspaceWorker = require('../workers/workspace'),
  ProjectWorker = require('../workers/project'),
  UserWorker = require('../workers/user'),
  AccessControlWorker = require('../workers/accessControl'),
  RoleWorker = require('../workers/role'),
  Token = require('../services/token');

module.exports.setup = async (req, res, next) => {
  console.log("UserAccountManager::Setup UserAccount");

  let payload = req.body;
  let user = req.user;

  let validateParamResponse = utils.ValidateParams(payload, ["workspaceName"]);
  if (!validateParamResponse.status) {
    console.log("Required parameters empty or not found", validateParamResponse.list);

    res.status(400);
    res.send(utils.Error(400, "Required parameters empty or not found", validateParamResponse.list));
    return;
  }

  // check user already exists 
  let _user = await UserWorker.GetOne({
    userName: user.sub
  }).catch((err) => {
    res.status(500);
    res.send(utils.Error(500, err.message, undefined));
  });

  // no user found on database
  if (_user == null) {
    console.log("user data found", _user);
    // query given workspace name to check 
    // whether it's already created.
    let workspace = await WorkspaceWorker.GetOne({
      workSpaceName: payload.workspaceName
    }).catch((err) => {
      res.status(500);
      res.send(utils.Error(500, err.message, undefined));
    });

    // no workspace found for given name
    if (workspace == null) {
      console.log(`${payload.workspaceName} workspace not found.`);

      let workspaceObj = {
        workSpaceName: payload.workspaceName,
        projects: [],
        users: [],
        description: "",
      }

      // save new workspace
      let newWorkspace = await WorkspaceWorker.Create(workspaceObj)
      .catch((err) => {
        res.status(500);
        res.send(utils.Error(500, 'Error getting while creating new workspace.', undefined));
      });

      // ** both tenant and workspaceId can use for query
      // project under specific workspace.

      let projectObj = {
        tenant: newWorkspace.tenant,
        projectName: `${newWorkspace.workSpaceName}'s Initial Project`,
        workSpaceName: newWorkspace.workSpaceName, 
        workSpaceId: newWorkspace["_id"], 
        description: "",
        users: [],
      }

      // add new project as default to newly 
      // created workspace
      let newProject = await ProjectWorker.Create(projectObj)
        .catch((err) => {
          res.status(500);
          res.send(utils.Error(500, 'Error getting while creating new project.', undefined));
        });

      let roleObj = {
        tenant: newWorkspace.tenant,
        company: newProject.company,
        roleName: "Super User",
      }

      const superUserPermissions = await getSuperUserPermissions();

      roleObj["permissions"] = superUserPermissions;

      let newRole = await RoleWorker.Create(roleObj)
        .catch((err) => {
          res.status(500);
          res.send(utils.Error(500, 'Error getting while creating new role.', undefined));
        });

      // both workspace and project created
      if (newWorkspace != null 
        && newProject != null && newRole != null) {
        console.log(`new workspace(${newWorkspace.tenant}) created. project(${newProject.company}) and role attached to that.`);

        let workspaceOwenerObj = {
          tenant: newWorkspace.tenant, // holds default workspace id
          company: newProject.company, // holds default project id
          userName: user.sub,
          email: user.email,
          bot: "",
          botUniqueId: "",
          description: "",
          roles: [{
            roleId: newRole["_id"],
            roleName: newRole.roleName,
            workspaceId: newWorkspace.tenant,
            projectId: newProject.company,
          }],
          groups:  [{
            groupId: "all",
            groupName: "all"
          }],
          workspaces:  [{ // list all workspaces whick user assigned
            workspaceId: newWorkspace.tenant,
            workspaceName: newWorkspace.workSpaceName
          }],
          projects:  [{ // list all projects whick user assigned
            projectId: newProject.company,
            projectName: newProject.projectName,
            workspaceId: newWorkspace.tenant
          }],
        }

        // create workspace owner
        let workspaceOwner = await UserWorker.Create(workspaceOwenerObj)
          .catch((err) => {
            res.status(500);
            res.send(utils.Error(500, 'Error getting while creating workspace owner.', undefined));
          });

        if (workspaceOwner != null) {
          console.log('workspace owner created', workspaceOwner.email);
          // update workspace by attaching
          // project and owner
          let workspaceUpdated = await WorkspaceWorker.UpdateOne({
            "_id": newWorkspace["_id"],
            "tenant": newWorkspace.tenant
          }, {
            $push: {
              projects: {
                projectId: newProject.company,
                projectName: newProject.projectName
              },
              users: {
                email: workspaceOwner.email,
                userId: workspaceOwner.userName
              }
            }
          });
          // update project by attaching
          // owner details
          let projectUpdated = await ProjectWorker.UpdateOne({
            "_id": newProject["_id"],
            "company": newProject.company
          }, {
            $push: {
              users: {
                email: workspaceOwner.email,
                userId: workspaceOwner.userName
              }
            }
          });

          if (workspaceUpdated != null
            && projectUpdated != null) {
            console.log('User account setted successfully');
            // generate jwt token with
            // user access and permission

            let obj = {
              tenant: newWorkspace.tenant,
              company: newProject.company,
              userName: workspaceOwner.userName,
              email: workspaceOwner.email,
              permissions: getAccessRules([newRole])
            }

            // workspaceOwenerObj["permissions"] = superUserPermissions;
            let token = Token.sign(obj);
  
            res.send(utils.Success(200, "User account setted successfully", token));
          }
        }
      }
    } else {
      res.status(400);
      res.send(utils.Error(400, `${payload.workspaceName} workspace is already exists.`));
    }
  } else {
    res.status(401);
    res.send(utils.Error(401, "No user found.", undefined));
  }
}

const getSuperUserPermissions = async () => {
  let permissions = [];

  let accessControls = await AccessControlWorker.GetAll()
    .catch((err) => {
      res.status(500);
      res.send(utils.Error(500, err.message, undefined));
    });

  accessControls.forEach(accessControl => {
    let permission = {
      permissionName: accessControl.permissionName,
      permissionObj: {}
    }

    accessControl.permissionObj.forEach(rule => {
      permission.permissionObj[rule] = true;
    });

    permissions.push(permission);
  });

  return permissions;
}

const getAccessRules = (roles) => {
  let accessRules = {};

  roles.forEach(role => {
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
  });

  return accessRules;
}