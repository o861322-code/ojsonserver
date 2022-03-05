const fs = require("fs");
const path = require("path");

const JwtToken = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/googleAuth/jwt.js").JwtToken;
const oAxios = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oAxios.js");
const oUtils = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oUtils.js");
const oCrytoJS = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oCrytoJS.js");

let scopes = "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email";
const metaOnHostFields = "a0metaonhost";

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

(async () => {
   //Get Files
   let dataPath = path.join(path.dirname(__filename), "..", options.DataDirectoryName);
   let files = oUtils.GetAllFiles(dataPath, []);
   files = files.filter((e) => e.toString().endsWith(options.DataExtensionFile)).sort();
   files = files.map((file) => {
      let result = {
         local_path: file,
         host_path: oUtils.oPath.ToHostPath(file.replace(dataPath, "")).replace(options.DataExtensionFile, ""),
         content_md5: "",
         content_json: oUtils.JSONLoadForce(file),
      };
      result.content_md5 = oCrytoJS.HashMD5Object({ content_json: result.content_json, host_path: result.host_path });
      return result;
   });
   let metaTo = files.reduce((total, file) => {
      total[file.content_md5] = file.host_path;
      return total;
   }, {});
   metaTo.content_md5 = oCrytoJS.HashMD5Object(metaTo);
   if (files.length === 0) return;

   /**
    * !Transfer data to rtdbs
    */
   let rtdbs = secrets.CONFIG.rtdbs || [];
   for (let i = 0; i < rtdbs.length; i++) {
      let rtdb = rtdbs[i];
      rtdb.access_token = (await JwtToken(rtdb.client_email, scopes, rtdb.private_key)).access_token;
      rtdb.rtdb_url = oUtils.oString.TrimEnd(rtdb.rtdb_url, "/");
      rtdb.metaonhost_url = `${rtdb.rtdb_url}/${metaOnHostFields}.json`;
      rtdb.axios_config = { url: rtdb.metaonhost_url, access_token: rtdb.access_token };
      await oAxios.Get(rtdb.axios_config).then((data) => {
         let metaOn = oUtils.ToObjectForce(data);
         if (!(metaTo.content_md5 in metaOn)) {
            let allPromises = files
               .filter((file) => !(file.content_md5 in metaOn))
               .map((file) => {
                  return oAxios.Put({ url: `${rtdb.rtdb_url}/${file.host_path}.json`, access_token: rtdb.access_token, data: file.content_json });
               });
            Object.keys(metaOn).map((key) => {
               if (key !== "content_md5" && !(key in metaTo)) {
                  allPromises.push(oAxios.Delete({ url: `${rtdb.rtdb_url}/${metaOn[key]}.json`, access_token: rtdb.access_token }));
               }
            });
            if (allPromises && allPromises.length > 0) {
               Promise.allSettled(allPromises).then((values) => {
                  if (values.length > 0 && values.findIndex((value) => value.status !== "fulfilled") === -1) {
                     oAxios.Put({ url: rtdb.metaonhost_url, access_token: rtdb.access_token, data: metaTo }).then((data) => {
                        console.log(`OK:${metaOnHostFields}:${rtdb.metaonhost_url}`);
                     });
                  }
               });
            }
         }
      });
   }
   return;
})();
