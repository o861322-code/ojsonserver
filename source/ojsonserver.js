const fs = require("fs");
const path = require("path");

const JwtToken = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/googleAuth/jwt.js").JwtToken;
// const oAxios = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oAxios.js");
const oUtils = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oUtils.js");
// const oCrytoJS = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oCrytoJS.js");
// const oBucket = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oBucket.js");
// const oAzGit = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oAzGit.js");
// const oAzTfvc = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oAzTfvc.js");
// const oGithub = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oGithub.js");
// const oGDrive = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oGDrive.js");
const JsonServer = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/JsonServer.js");

const InitializeExecuter = () => {
   let options = {};
   let optionsPath = path.join(path.dirname(__filename), "option.executer.json");
   if (fs.existsSync(optionsPath)) {
      options = JSON.parse(fs.readFileSync(optionsPath, { encoding: "utf-8" }));
   }
   return options;
};
const InitializeSecrets = (options) => {
   const isShowLog = options?.IsShowLogInitializeSecrets || false;
   if (isShowLog) {
      console.log("=====InitializeSecrets=====");
   }
   let secrets = {};
   if ("context_github" in process.env) {
      secrets.context_github = JSON.parse(process.env.context_github);
   }
   if ("GITHUB_secrets" in process.env) {
      const GITHUB_secrets = JSON.parse(process.env.GITHUB_secrets);
      for (const [key, value] of Object.entries(GITHUB_secrets)) {
         if (key !== "github_token") secrets[key] = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
      }
   } else {
      let secretsPath = path.join(path.dirname(__filename), ".githubsecrets");
      if (fs.existsSync(secretsPath)) {
         let files = fs.readdirSync(secretsPath);
         let extension = ".githubsecrets.json";
         for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.endsWith(extension)) {
               let contentFile = fs.readFileSync(path.join(secretsPath, file), { encoding: "utf8" });
               secrets[file.replace(extension, "")] = JSON.parse(contentFile);
            }
         }
      }
   }
   secrets.CONFIG = oUtils.MapFieldsConfig(secrets.CONFIG);
   if (isShowLog) {
      console.log(JSON.stringify(secrets, null, "\t"));
      console.log("=====END:InitializeSecrets=");
   }
   return secrets;
};
const options = InitializeExecuter();
const secrets = InitializeSecrets(options);

const GetConfigHosts = () => {
   let configHosts = [];
   options.ConfigSyncFields.forEach((field) => {
      let configs = secrets.CONFIG[field] || [];
      configs.forEach((config) => configHosts.push(config));
   });
   return configHosts;
};
(async () => {
   /**
    * ! Get Local Files
    */
   oUtils.Log.SetLogDirectoryPath(path.join(path.dirname(__filename), "logs"));
   let dataPath = path.join(path.dirname(__filename), "..", options.DataDirectoryName);
   let metaTo = JsonServer.LoadLocalMetaTo(options, dataPath);
   let configHosts = GetConfigHosts();
   for (let i = 0; i < configHosts.length; i++) {
      JsonServer.AcceptChanges(JSON.parse(JSON.stringify(metaTo)), configHosts[i]);
      // if (i === 4) break;
   }
})();
