// exceljs ships a browser bundle without Node-only deps (fs, rimraf…); we load
// that one in the client so OpenNext's server bundle never sees them.
declare module "exceljs/dist/exceljs.min.js" {
  import * as ExcelJS from "exceljs";
  export = ExcelJS;
}
