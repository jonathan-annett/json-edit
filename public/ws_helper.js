/* global ace,loadWithValidate,applyHysteresis, sha256 */

function ws_helper(route,connectMessage,onConnect) {
  route = route || location.pathname.split("?")[0];
  
  var host_port = location.origin.split("://")[1],
      protocol = location.protocol.startsWith("https:") ? "wss:" : "ws:",
      ws_url = protocol + "//" + host_port + route,
      statusClass = {};
  
  const connectString = JSON.stringify(  {"connect":connectMessage||{},"cb":"cb0"});

  Object.defineProperties(statusClass, {
    element: {
      value: qs("html"),
      enumerable: false
    },
    add: {
      value: function(s) {
        statusClass.element.classList.add(s);
      },
      enumerable: true
    },
    remove: {
      value: function(s) {
        statusClass.element.classList.remove(s);
      },
      enumerable: true
    }
  });

  const onWSerrorClose = applyHysteresis(restartSocketHandler, 4000);
  let socketConnection;
  const socketCallbacks = {};
  
  restartSocketHandler();
  



  function restartSocketHandler() {
    
    statusClass.add("closed");

    socketConnection = new WebSocket(ws_url);

    socketConnection.addEventListener("open", onWSopen);
    socketConnection.addEventListener("message", onWSmessage);

    socketConnection.addEventListener("error", onWSerrorClose);
    socketConnection.addEventListener("close", onWSerrorClose);


    function onWSopen(connectionEvent) {
      //console.log('websocket connection is open', connectionEvent);
      socketCallbacks.cb0 = function(err, msg) {
        statusClass.remove("sending");
        if (err) {
           return onConnect ? onConnect(err) : console.log(err);
        }

        statusClass.remove("loading");
        if (onConnect)  onConnect(undefined,msg);
      };
      statusClass.remove("closed");
      statusClass.add("sending");
      socketConnection.send(connectString);
    }

    // when a message is received from the socket connection,
    // the message will contain the id of a button that the other player clicked
    function onWSmessage(event) {
      let cb;
      try {
        const json = event.data;
        const msg = JSON.parse(json);
        const cb_id = typeof msg.cb === "string" ? msg.cb : false;
        cb = cb_id ? socketCallbacks[cb_id] : false;
        if (cb) {
          delete msg.cb;
          if (!cb.persist)
             delete socketCallbacks[cb_id];
          if (typeof cb === "function") {
            if (msg.error) {
              cb(msg.error);
            } else {
              cb(undefined, msg);
            }
          }
        }
      } catch (e) {
        if (typeof cb === "function") {
          cb(e);
        }
      }
    }
  }

  function qs(q) {
    return document.querySelector(q);
  }
  
  const 
  events = {},
  eventSetterName = function(e) {
    return 'on'+e.charAt(0).toUpperCase()+e.substr(1).toLowerCase();
  },
  self = {
     statusClass : statusClass,
     socketCallbacks : socketCallbacks,
     send : function (cmd,msg,cb,persist) {
         const payload = {};
         payload[cmd]=msg;
         var cb_id; 
         if (typeof cb==='function') {
            cb_id = Math.random().toString(36) ;
            payload.cb = cb_id;
            socketCallbacks[  cb_id ] = cb;
            if (persist) {
              payload.persist = persist;
              cb.persist = persist;
            }
         }
         socketConnection.send(JSON.stringify(payload));
         return cb_id; 
     },
     addEventListener : function(e,fn) {
       
       if (typeof e==='string'&& typeof fn === 'function') {

          const cb_id = self.send( eventSetterName(e),{  },function(err,msg){
              if (err) {
                console.log("error", err.message||err,"removing handler for",e);
                return self.removeEventListener(e,fn);
              }
              if (msg) {
                 fn(msg[e])
              }
          },true);
         
          const stack = events[e] ? events[e] : (events[e]={});
          stack[cb_id]=fn;
         
       }
       
     },
     removeEventListener : function(e,fn){
       if (typeof e==='string'&& typeof fn === 'function' && typeof events[e]==='object') {
         const stack = events[e];
         const ids = Object.keys(stack);
         ids.forEach(function(cb_id){
           if (stack[cb_id]===fn) {
               self.send( eventSetterName(e),{ remove:cb_id },function(err,msg){
                  delete socketCallbacks[cb_id];
                  delete stack[cb_id];  
                  delete fn.persist;
               });
           }
         });
       }
    }
  };
  
  Object.defineProperties(self,{
    socketConnection : {
      get : function () {
        return socketConnection;
      },
      enumerable : true
    }
  });
  
  return self;
}
