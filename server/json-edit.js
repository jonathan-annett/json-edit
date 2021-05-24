const loadWithValidate = require('../public/validate.js').loadWithValidate;
const applyHysteresis = require('../public/hysteresis.js').applyHysteresis;
const sha256Node = require ('sha256'), { sha256 } = sha256Node; 
const path = require("path"); 


const aceExpressModule = require('ace-express');
let aceExpress;
let public_files=false;
const objectsEdited = {};

function jsonEditor( app, express, server, obj, displayName, template,route, theme) {
  const json = JSON.stringify(obj);
  const expressws = require("express-ws")(app,server);
  const rand  = Math.floor(Math.random()*16384);
  const rand2 = Math.floor(Math.random()*16384);
  const num   = Date.now() % 16384;
  const id_str = [rand,rand2,num,rand ^ rand2 ^ num].map((x)=>x.toString(36)).join('-');
  
  const meta =  (objectsEdited[id_str] = {
     id:id_str,
     displayName:displayName,
     current:obj,
     route:route,
     template:template
  });  
  
  const connections = [];
  const broadcast = function (x,butnot) {
    let active = connections.filter(function(ws){
      return (ws.readyState<2); 
    });
    active.forEach(function (peer){
       if (peer!==butnot && peer.readyState===1) {
         peer.send(x);
       }
    });

    connections.splice.apply(connections,[0,connections.length].concat(active));    
  };
  
  const events = {  change : [], theme : [], update : [],save :[] };
  
  const emit = function (ev,obj,not_fn) {
     if (Array.isArray(events[ev])) {
       events[ev].forEach(function(hnd){
          if (hnd===not_fn) return ;
          hnd(obj);
       });
     }
  };
  const self = {}, implementation = {
    
    current: {
      get : function () {
         return meta.current;
      },
      set : function (value) {
         
      }
    },
    
    theme : {
       get : function () {
         return meta.theme;
       },
       set : function (value) {
         meta.theme=value;
         emit("theme",value);
       },
       enumerable:true
     },
    
    addEventListener : {
       value : function (e,fn,ws) {
          if (typeof e==='string' && typeof fn ==='function' && Array.isArray(events[e])) {
            events[e].push(fn);
            
            /*
            if (fn.cb_id) {
                if (fn.name) {
                    console.log("added",e,"event: function <"+fn.cb_id+">",fn.name,"(e){...}");
                } else {
                  console.log("added",e,"event: function <"+fn.cb_id+"> (e){...}");
                }

            } else {
                if (fn.name) {
                    console.log("added",e,"event: function",fn.name,"(e){...}");
                } else {
                  console.log("added",e,"event: function (e){...}");
                }
              
            } */
            if (ws) {
               fn.ws = ws;
            }
            
          }
       },
       enumerable:true
     },
    
    removeEventListener : {
       value : function (e,fn,cb_id) {
         
          const stack = events[e];
          if (typeof e==='string' && typeof fn ==='function' && Array.isArray(events[e])) {
             stack.splice.apply(
              
              stack,[
                0,stack.length // clear the  list
              ].concat(
                  // add replace it with everything except for the supplied function
                  stack.filter(function(fnX){
                    if (fnX===fn) {
                      //console.log("located and removed function:",fn.cb_id);
                      return false;
                    } else {
                      return true;
                    }
                  })
              
            ));
          }
         
          if (typeof e==='string' && typeof cb_id ==='string' && Array.isArray(events[e])) {
            stack.splice.apply(
              
              stack,[
                0,stack.length // clear the  list
              ].concat(
                  // add replace it with everything except for functions tagged with this cb_id
                  stack.filter(function(fnX){
                    if (fnX.cb_id===cb_id) {
                      //console.log("located and removed fn with cb_id:",cb_id);
                      return false;
                    } else {
                      return true;
                    }
                  })
              
            ));
            
            
            //console.log("removed",e,"event");
          }
       },
       enumerable:true
     },
    
    emit : {
      value  : emit,
      enumerable:true
      
    }
     
  };
  
  
  function remoteEvent(e) { 
    
      const handlerName = e+"Setter";
      
      const handler  = function (meta,req,ws,cmd,cb_id,nosend) {
          if (cmd.remove) {
            self.removeEventListener(e,undefined,cmd.remove)
          } else {
            const setter = function(value){
              let payload = {cb:cb_id};
              payload[e]=value;
              payload=JSON.stringify(payload);
              if (nosend)  {
                 return payload;
              }
              switch (ws.readyState) {

                case 0://	CONNECTING	Socket has been created. The connection is not yet open.
                   //console.log('defering theme set (connecting):',value);
                   setTimeout(setter,500,value);
                  break;
                case 1://	OPEN	The connection is open and ready to communicate.
                   try {
                      // console.log('invoking '+e+' set:',value);
                       ws.send(payload);
                    } catch ( e) {
                      // console.log("removing handler:",e.message);
                       self.removeEventListener(e,undefined,cb_id)
                    }
                  break;
                case 2://	CLOSING	The connection is in the process of closing.
                case 3://	CLOSED	The connection is closed or couldn't be opened.
                   self.removeEventListener(e,undefined,cb_id)
              }  
            };
            if (nosend) {
              return setter(meta); 
            }
            setter.name = handlerName;
            setter.cb_id = cb_id;
            self.addEventListener(e,setter,ws);
            //console.log(e+" setter defined")
          }
      }

    
      return handler ;
  }
  
  
  const handlers = {

    onTheme : remoteEvent("theme"), 
    
    onUpdate : remoteEvent("update"), 
    
    onSave   : remoteEvent("save"), 
   
    // connect is sent by the browser after it first connects
    // the server sends back the existing data, it's name, and a validation template
    connect : function (meta,req,ws,cmd,cb_id) {
      meta.cb=cb_id;
      ws.send(JSON.stringify(meta));
      delete meta.cb;
    },

    //edited is sent whenever the browser text changes, and the result is a (different, valid JSON string)
    change: function (meta,req,ws,json,cb_id) {
      try {
         // pull in the edited json (should have been prevalidated in browser, but check wrap in try/catch anyway)
        const validate = JSON.parse(json);
       
         if ( (typeof validate==='object') && !Array.isArray(validate) ) {
            // only attempt to store a keyed object - can't be an array at the outer level.
            loadWithValidate (meta.current,validate,meta.template);
            ws.send(JSON.stringify({cb:cb_id}));
            emit("change",meta);
         } else  {
            ws.send(JSON.stringify({error:"invalid object",cb:cb_id}));
         }
        
        // manually send custom message to each other websocket connection 
        // informing them that data has been updated.
        const active = events.update.filter(function(handler){
           if (!handler.ws || handler.ws===ws) return true;
           if (handler.ws.readyState>=2) {
              return false;
           }
          
           if (handler.cb_id) {
             const payload = handlers.onUpdate (meta.current,req,ws,{},handler.cb_id,true) ;
             if (payload) {
                handler.ws.send(payload);
             }
           } 
          return true
        });
        
        events.update.splice.apply(events.update,[0,events.update.length].concat(active));
        
      
      } catch (e) {
           ws.send(JSON.stringify({error:e.message||e,cb:cb_id}));
      }    
    }

  };

  
  
  if (theme) {
    meta.theme = theme;
  }
  
  app.use(express.static(path.join(__dirname,"..","public")));   
  
  sha256Node.express(app,express,path.join(route,'sha256'));
  
  if (!aceExpress) {
    aceExpress = aceExpressModule.express(app);
  }
    
  app.get(route,function(req,res){
      console.log("get",req.url);
      res.sendFile(path.join(__dirname, "..","views","index.html"));
  });
  
  app.ws(route,function(ws, req) {
      
    console.log("app.ws",req.url,typeof ws);
    connections.push(ws);
    
    const wsSend = ws.send.bind(ws);
    ws.send = function (x,others) {
       if (!others) {
          
          switch (ws.readyState) {
            case 0 : return setTimeout(ws.send,500,x);
            case 1 : 
              //console.log("ws.send:>>>",x);
              return wsSend(x);
          }
          const ix = connections.indexOf(ws);
          if (ix >=0) connections.splice(ix,1);
          return; 
       }
      
      let active = connections.filter(function(ws){
            return (ws.readyState<3); 
      });
      
      active.forEach(function (peer){
         if (peer!==ws && peer.readyState===2) {
           peer.send(x);
         }
      });
      connections.splice.apply(connections,[0,connections.length].concat(active)); 
      
    };
    
    ws.on('message', function(json) {
     // console.log('ws.message <<<',json);
      try {
          const msg = JSON.parse(json);
          const cmd = Object.keys(msg)[0];
          const handler = cmd ? handlers[cmd] : false;
          if (typeof handler==='function') {
            handler(meta,req,ws,msg[cmd],msg.cb);
          }
      } catch (err) {
        console.log('err',err);
        ws.send(JSON.stringify({error:err.message||err}));
      }
    });   
    
    ws.on('close',function(){
       let ix = connections.indexOf(ws);
       while (ix >= 0 ) {
          connections.splice(ix,1);
         ix = connections.indexOf(ws);
       } 
    });
    
    
    
  });
  
 
  Object.defineProperties(self,implementation);
  return self;
}


module.exports = jsonEditor;

