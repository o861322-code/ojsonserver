const fs = require("fs");
const path = require("path");

const oUtils = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oUtils.js");
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
   let s2 = { count_file: metaTo.syncfiles.length, detail: metaTo.syncfiles.map((syncfile) => syncfile.host_path).join("\n") };
   let configHosts = GetConfigHosts();
   for (let i = 0; i < configHosts.length; i++) {
      let config = configHosts[i];
      let cloneMetaTo = JSON.parse(JSON.stringify(metaTo));
      config.execute_status = { s0: `[${i + 1}/${configHosts.length}]`, s1: `${config.id_host}`, s2: s2 };
      config.execute_status.time = { start: new Date().getTime() };
      JsonServer.AcceptChanges(cloneMetaTo, config);
   }
})();
