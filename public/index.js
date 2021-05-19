/* global ace,loadWithValidate,applyHysteresis, sha256,ws_helper */

var

  meta,last_json,
  editor = ace.edit("editor"),
  h1 = qs("h1"),
  wsh = ws_helper(location.pathname.split('?')[0],{},
                  function(err,msg){
      if (err) {
       meta = undefined;
       console.log(err);
       return;
     }
    
     meta = msg;
     last_json=JSON.stringify(meta.current);
     const pretty_json = JSON.stringify(meta.current,undefined,4);
     editor.getSession().setValue(pretty_json);
     if (meta.displayName) {
         h1.innerHTML = meta.displayName;
         document.title = meta.displayName;
     } else {
        meta.displayName = document.title;
     }

     setTheme (meta.theme||"cobalt");
    
     wsh.addEventListener("theme",setTheme);
    
     wsh.addEventListener("update",onUpdateByPeer);
    
     wsh.addEventListener("save",onIncomingSave);                  
}),


  statusClass = wsh.statusClass;

 

  const hasChanged = applyHysteresis(
    function(){
      onEditorChange();
      statusClass.remove('changed');
    },
    250
  );

   editor.getSession().on('change', function (){
      
      statusClass.add('changed');
      hasChanged();
      
    } );


function setTheme (theme) {
   theme = theme || "cobalt";
   editor.setTheme("ace/theme/"+theme);
   qs("body").className="ace-"+theme;
   h1.className="ace-"+theme;
   editor.session.setMode("ace/mode/json");
}

function onIncomingSave(state) {
  
    if(state.done) {
      last_json=undefined;
      onUpdateByPeer (state.done);
      
      return statusClass.remove('saving');
      
      
      
    }
  
    if (state.fs) {
        return statusClass.add('saving');
    }
  
    statusClass.add('saving');
   
    
}

function onUpdateByPeer (current) {
   const this_json=JSON.stringify(current);
   if (last_json===this_json) return;
   meta.current=current;
   const pretty_json = JSON.stringify(meta.current,undefined,4);
  
  
  var pos = editor.session.selection.toJSON()
  editor.getSession().setValue(pretty_json);
  editor.session.selection.fromJSON(pos)
  
   last_json=this_json;
}

function onEditorChange () {

      if (!meta) return;


      var json = editor.getSession().getValue();
      if (json.trim().length===0) json='{}';

      try {
         // step 1 - is it valid json?  
         const obj = JSON.parse(json);
        // step 2 - is it an object, not an array ?
         if (typeof obj==='object'&& !Array.isArray(obj)) {

           //step 3 
           loadWithValidate(meta.current,obj,meta.template,false);
           // if we reach this line, the JSON must be valid.
           statusClass.remove('invalid_JSON');

           const this_json = JSON.stringify(meta.current);

           sha256(this_json,'hex',function(err,hash){
               if(this_json===last_json) {
                  h1.innerHTML = meta.displayName +'<span>'+hash+'</span>';
                  return;
               }
             
              wsh.send("change",this_json,function(err,msg){
                 if (err) {
                   h1.innerHTML = meta.displayName+'&nbsp;<span>'+err+'</span>';
                   statusClass.add('invalid_JSON');
                   statusClass.remove('saving');
                   return;
                 }
                 h1.innerHTML = meta.displayName +'<span>'+hash+'</span>';
              });
              last_json = this_json;

           });

         } else {
            statusClass.add('invalid_JSON');
            statusClass.remove('saving');
         }

      } catch (e) {
         
        if (meta) {
           h1.innerHTML = meta.displayName+'&nbsp;<span>'+e.message+'</span>';
        }    
         statusClass.add('invalid_JSON');
         statusClass.remove('saving');
      }
    }
  
function qs(q){return document.querySelector(q);}