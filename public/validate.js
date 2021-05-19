(function(exports){
  function loadWithValidate(current,validate,template) {
  const valid_keys = Object.keys(template);
  Object.keys(validate).filter(function(k){
      if ( valid_keys.indexOf(k)<0) return false;// keynames must match template
      let existing = current[k],sample = template[k],sample_type = typeof sample,incoming=validate[k];
      if ( typeof incoming !== sample_type ) {
        switch(sample_type) {
          case "number":
             const tryFix = Number(incoming);
             if (isNaN(tryFix)) return false;
             validate[k]=tryFix;
             return true;
          case "string":
              switch (typeof incoming) {
                 case 'number':
                 case 'boolean':
                     validate[k]=String(incoming);
                     return true;
                case 'object': 
                  if (incoming.constructor===Date) {
                     validate[k]=String(incoming);
                     return true;
                  }
              }
            
        }
        return false;// object type must match template
      }
      if (sample_type !== "object") return true; // auto accept all primitives.
      // differentiate between keyed objects and arrays in the template sample
      if (Array.isArray(sample)) {
        // sample is an array, in the format [ <length>, <subTemplate> ], where length = number of elements expected, or 0 if any length is permitted, -n for up to n elements permitted
        const count = sample[0],default_el=sample[1],el_type = typeof def_el;
        if (sample.length===2 && typeof count==='number') {
            // precise array length specified
            if (count<=0 || incoming.length===count) {
                // ignore values in incoming array unless it conforms to length specification
                // (0 specifies any length is permitted) 
               
                if (count<0) {
                  // prune the incoming array to not exceed the imposed limit
                  incoming = incoming.slice(0,0-count);
                }
              
                if (el_type==='object') {
                   // array of objects - we are going to recurse deeper into loadWithValidate()
                  
                   current[k] = incoming.map(function(validate){
                      const v={};
                      loadWithValidate(v,validate,default_el);
                      return v;
                   });
                  
                } else {
                   // array of primitives. simple validate and load each element from incoming to existing
                   current[k] = incoming.map(function(inc){
                     return (typeof inc===el_type) ? inc:  default_el;
                   });
                }
            }
          
        }
      } else {
         // sample is declared as a keyed object
         loadWithValidate(existing,incoming,sample);
         return false;
      }
    }).forEach(function(k){
      current[k] = validate[k];
    });
  }
  exports.loadWithValidate = loadWithValidate;
})(typeof window==='object' ? window : module.exports);