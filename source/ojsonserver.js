const fs = require("fs");
const path = require("path");

const JwtToken = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/googleAuth/jwt.js").JwtToken;
const oAxios = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oAxios.js");
const oUtils = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oUtils.js");
const oCrytoJS = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oCrytoJS.js");
const oBucket = require("E:/CLOUDCODE/Github/oListRepos/NodeJS/oModules/oBucket.js");

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

const TransferTo = async (files, metaTo, field) => {
   let uploadTos = secrets.CONFIG[field] || [];
   let _gbucket_rootpath = (uploadTo) => {
      if ("root_path" in uploadTo && oUtils.oString.IsNotEmpty(uploadTo.root_path)) {
         return oUtils.oString.TrimStartEnd(uploadTo.root_path) + "/";
      }
      return "";
   };
   let _get_access_token = async (uploadTo, field) => {
      if ("|rtdbs|gbuckets|".includes(field)) {
         let upload_scopes = scopes;
         switch (field) {
            case "gbuckets":
               upload_scopes = "https://www.googleapis.com/auth/devstorage.full_control";
               break;
         }
         return JwtToken({ ...uploadTo, scopes: upload_scopes });
      }
      return undefined;
   };
   let _recheckConfig = async (uploadTo, field) => {
      switch (field) {
         case "gbuckets":
            uploadTo.access_token = (await _get_access_token(uploadTo, field)).access_token;
            break;
         case "rtdbs":
            uploadTo.access_token = (await _get_access_token(uploadTo, field)).access_token;
            uploadTo.rtdb_url = oUtils.oString.TrimEnd(uploadTo.rtdb_url, "/");
            uploadTo.metaonhost_url = `${uploadTo.rtdb_url}/${metaOnHostFields}.json`;
            uploadTo.axios_config = { access_token: uploadTo.access_token, url: uploadTo.metaonhost_url };
            break;
      }
      return uploadTo;
   };
   let _get_metaOn = async (uploadTo, field) => {
      switch (field) {
         case "rtdbs":
            return oAxios.Get(uploadTo.axios_config).then((data) => Promise.resolve(oUtils.ToObjectForce(data)));
            break;
         case "gbuckets":
            return oBucket.ReadJSONForce({ ...uploadTo, host_path: `${_gbucket_rootpath(uploadTo)}${metaOnHostFields}.json` });
            break;
      }
   };
   let _create_promise_upload = (uploadTo, field, file) => {
      switch (field) {
         case "rtdbs":
            return oAxios.Put({ access_token: uploadTo.access_token, url: `${uploadTo.rtdb_url}/${file.host_path}.json`, data: file.content_json });
         case "gbuckets":
            return oBucket.UploadFile({
               ...uploadTo,
               host_path: `${_gbucket_rootpath(uploadTo)}${file.host_path}.json`,
               buffer: Buffer.from(JSON.stringify(file.content_json), "utf8"),
               metadata: { onFunction: "_create_promise_upload" },
            });
      }
   };
   let _create_promise_delete = async (uploadTo, field, metaOn, key) => {
      //console.log({ mess: `Vao day:`, uploadTo, field, metaOn, key });
      switch (field) {
         case "rtdbs":
            return oAxios.Delete({ access_token: uploadTo.access_token, url: `${uploadTo.rtdb_url}/${metaOn[key]}.json` });
            break;
         case "gbuckets":
            return oBucket
               .Detele({
                  ...uploadTo,
                  host_path: `${_gbucket_rootpath(uploadTo)}${metaOn[key]}.json`,
               })
               .then((data) => console.log(`DeleteOK:${data}`))
               .catch((error) => console.error(error));
      }
   };
   let _create_promise_upload_meta = (uploadTo, field, metaTo) => {
      switch (field) {
         case "rtdbs":
            return oAxios.Put({ access_token: uploadTo.access_token, url: uploadTo.metaonhost_url, data: metaTo }).then(() => {
               console.log(`OK:${metaOnHostFields}:${uploadTo.metaonhost_url}`);
            });
            break;
         case "gbuckets":
            return oBucket
               .UploadFile({
                  ...uploadTo,
                  host_path: `${_gbucket_rootpath(uploadTo)}${metaOnHostFields}.json`,
                  buffer: Buffer.from(JSON.stringify(metaTo), "utf8"),
                  metadata: { onFunction: "_create_promise_upload_meta" },
               })
               .then((data) => console.log(`OK:${metaOnHostFields}:${data.id}`));
            break;
      }
   };
   let uploadTo = undefined;
   let metaOn = undefined;
   try {
      for (let i = 0; i < uploadTos.length; i++) {
         uploadTo = await _recheckConfig(uploadTos[i], field);
         metaOn = await _get_metaOn(uploadTo, field);
         if (!(metaTo.content_md5 in metaOn)) {
            let allPromises = files
               .filter((file) => !(file.content_md5 in metaOn))
               .map((file) => {
                  return _create_promise_upload(uploadTo, field, file);
               });
            Object.keys(metaOn).map((key) => {
               if (key !== "content_md5" && !(key in metaTo) && key in metaOn) {
                  allPromises.push(_create_promise_delete(uploadTo, field, metaOn, key));
               }
            });
            if (allPromises && allPromises.length > 0) {
               Promise.allSettled(allPromises).then((values) => {
                  if (values.length > 0 && values.findIndex((value) => value.status !== "fulfilled") === -1) {
                     _create_promise_upload_meta(uploadTo, field, metaTo);
                  }
               });
            }
         }
      }
   } catch (error) {
      console.error(error);
   } finally {
      //console.log({ metaTo, uploadTo, metaOn });
   }
};

(async () => {
   /**
    * !Get Local Files
    */
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
   let transfer_fields = ["rtdbs", "gbuckets"];
   for (let i = 0; i < transfer_fields.length; i++) {
      let upload_field = transfer_fields[i];
      if (options[`IsTransferTo_${upload_field}`] === true) {
         TransferTo(files, metaTo, upload_field);
      }
   }
   return;
})();
