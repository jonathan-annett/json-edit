// server.js
// where your node app starts

// we've started you off with Express (https://expressjs.com/)
// but feel free to use whatever libraries or frameworks you'd like through `package.json`.
const express = require("express"); 
const app = express();
const glitchJSON = require("glitch-secure-json"); 
const secureJSONEditor = require("./server/glitch-secure-json-edit.js");
 
const sha256Node = require ('sha256'), { sha256 } = sha256Node; 
 
// you only need 1 of these, but no harm in serving it twice.
sha256Node.express(app,express);// for <script src="/sha256.js"></script>
 
const fs = require('fs');   

const route = '/edit/object'; 
const displayName = "the Object";
const filename = '/app/config/settings.json';
const obj={ aString:'hello world',aNumber:42};
const theme = "chaos";
const template = { 
  aString:'',aNumber:0 
};     
 
 
app.use(express.static("public"));      

// https://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => { 
  response.redirect(route);    
});  

const editor = secureJSONEditor(app,express,filename,displayName,template,route,theme) 


// listen for requests :)
const listener = app.listen(process.env.PORT, function () {
  console.log("Your app is listening on port " + listener.address().port); 
}); 
 
 