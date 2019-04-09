const utils = require('../utils'),
  WorkspaceWorker = require('../workers/workspace'),
  ProjectWorker = require('../workers/project'),
  UserWorker = require('../workers/user'),
  AccessControlWorker = require('../workers/accessControl'),
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
        projectName: `Project 01`,
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

      // both workspace and project created
      if (newWorkspace != null 
        && newProject != null /*&& newRole != null*/) {
        console.log(`new workspace(${newWorkspace.tenant}) created. project(${newProject.company}) attached to that.`);

        let workspaceOwenerObj = {
          tenant: newWorkspace.tenant, // holds default workspace id
          company: newProject.company, // holds default project id
          userName: user.sub,
          email: user.email,
          bot: "",
          botUniqueId: "",
          description: "",
          roles: [{
            roleId: "all",
            roleName: "Super User",
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

            // get super user permissions
            const superUserPermissions = await getSuperUserPermissions();

            let obj = {
              tenant: newWorkspace.tenant,
              company: newProject.company,
              userName: workspaceOwner.userName,
              email: workspaceOwner.email,
              permissions: superUserPermissions,
              subscription : {
                current : "free_plan",
                intented : "self_managed_plan"
              }
            }

            // generate jwt token with user access and permission
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
    res.send(utils.Error(401, "User already exists.", undefined));
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