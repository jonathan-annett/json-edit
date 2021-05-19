(function(exports){

  function applyHysteresis(fn,ms,b4) {
    const THIS=this;

    return function(){
      
      const args = arguments.length>0 ? [].slice.apply(arguments): false;
      
      if (typeof b4==='function') {
         if (args) {
          b4.apply(THIS,args);
        } else {
          b4();
        }
      }

      if (fn.timer) clearTimeout(fn.timer);
      fn.timer = undefined;
      
      
      if (fn.name) {
         console.log('defering',fn.name,'for',ms,'msec');
      }
      fn.timer = setTimeout(function(){
        if (fn.name) {
           console.log('invoking',fn.name,'after',ms,'msec deferment');
         }

        fn.timer=undefined;
        if (args) {
          fn.apply(THIS,args);
        } else {
          fn();
        }
      },ms);
    };
  }

  exports.applyHysteresis = applyHysteresis;
})(typeof window==='object' ? window : module.exports);