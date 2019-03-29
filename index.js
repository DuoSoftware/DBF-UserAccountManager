const restify = require('restify'),
  config = require('config'),
  corsMiddleware = require('restify-cors-middleware');

const authorization = require('./services/authorization'),
  UserAccountController = require('./controllers/userAccount'),
  AccountPermissionController = require('./controllers/accountPermission');

const MongooseConnection = new require('dbf-dbmodels/MongoConnection');
let connection = new MongooseConnection();

const server = restify.createServer({
  name: "User Account Manager",
  version: config.Host.version
}, function (req, res) {

});

const cors = corsMiddleware({
  allowHeaders: ['authorization', 'companyInfo']
});

server.pre(cors.preflight);
server.use(cors.actual);
server.use(restify.plugins.queryParser({
  mapParams: true
}));
server.use(restify.plugins.bodyParser({
  mapParams: true
}));

process.on('uncaughtException', function (err) {
  console.error(err);
  console.log("Node NOT Exiting...");
});
// config.Host.port
server.listen(3031, () => {
  console.log('%s listening at %s', server.name, server.url);
});

server.get('/', (req, res) => { res.end(JSON.stringify({
    name: "User Account Manager",
    version: config.Host.version
  }));
});

server.post('/dbf/:version/setup/useraccount', authorization(), UserAccountController.setup);

server.get('/dbf/:version/user/permissions', authorization(), AccountPermissionController.get);