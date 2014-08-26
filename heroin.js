(function() {
  function map(list, func) {
    var res = Array(list.length);
    var len = list.length;
    for (var i = 0; i < len; i++) {
      res[i] = func(list[i]);
    }
    return res;
  }
  function filter(list, func) {
    var res = [];
    var len = list.length;
    for (var i = 0; i < len; i++) {
      var val = list[i];
      if (func(val)) {
        res.push(val);
      }
    }
    return res;
  }

  function trim(str) {
    return str.replace(/^\s+|\s+$/g, '');
  }

  function funcParams(func) {
    if (typeof func !== 'function') {
      throw new Error('Not a function: ' + func);
    }

    var mapped = map(
        /\(([\s\S]*?)\)/.exec(func)[1].replace(/\/\*.*\*\//g, '').split(','), 
        trim);

    return filter(mapped, function(a) {
      return a;
    });
  }

  function inheritObject(fromObj) {
    var F;
    F = function() {};
    F.prototype = fromObj;
    return new F;
  }

  function Injector(parent, values, providers) {
    var me;
    this.parent = parent;
    this.values = values || {};
    this.providers = providers || {};
    me = this;
    this.values.$injector = this;
    this.values.di = this;
    this.values.make = function(ctor, extraArgs) {
      return new Injector(me, extraArgs).instantiate(ctor);
    };
    this.values.invoke = function(func, extraArgs) {
      return me.invoke(func, extraArgs);
    };
    this.make = this.values.make;

    // Use the parent's annotate function if present, otherwise funcParams.
    // E.g. if the ultimate ancestor is angular's injector, we will automatically
    // support other annotate strategies such as $inject property or array method.
    this.annotate = (parent && parent.annotate) || funcParams;
  }

  Injector.prototype.child = function(mappings) {
    var child = new Injector(this);
    if (mappings) {
      child.load(mappings);
    }
    return child;
  };

  // Resolution

  Injector.prototype.get = function(name, optional) {
    var maybeVal;
    maybeVal = this.localGet(name);
    if (maybeVal !== void 0) {
      return maybeVal;
    }
    if (this.parent) {
      return this.parent.get(name);
    }

    if (!optional) {
      throw new Error('Unresolved dependency: ' + name);
    }

    return void 0;
  };

  Injector.prototype.invoke = function(func, self, extraArgs) {
    if (typeof func !== 'function') {
      throw new Error("Invalid func: " + func);
    }
    return func.apply(self, this.resolveArgs(func, extraArgs, false));
  };

  Injector.prototype.instantiate = function(ctor, extraArgs) {
    if (!ctor) {
      throw new Error("Constructor not provided");
    }

    function Dummy() {};
    Dummy.prototype = ctor.prototype;
    var instance = new Dummy;
    this.invoke(ctor, instance, extraArgs);
    return instance;
  };

  Injector.prototype.resolve = function(funcOrName) {   
    if (typeof funcOrName === 'function') {
      return this.invoke(funcOrName);
    } else {
      return this.get(funcOrName);
    }
  };

  function insertArgs(incomplete, remaining) {
    var len = incomplete.length;
    var index = 0;
    var args = incomplete.slice(); // copy
    for (var i = 0; i < len; i++) {
      if (args[i] === void 0) {
        args[i] = remaining[index++];
      }
    }

    len = remaining.length;
    while (index < len) {
      args.push(remaining[index++]);
    }
    return args;
  }

  Injector.prototype.curry = function(func, self, extraArgs) {
    var curried, me = this;
    func = this.asFunction(func);

    return function(/* args... */) {
      if (!curried) {
        curried = me.resolveArgs(func, extraArgs, true);
      }

      return func.apply(self, insertArgs(curried, arguments));
    };
  };

  Injector.prototype.factory = function(ctor, extraArgs) {
    var curried, me = this;
    ctor = this.asFunction(ctor);

    function Dummy() {};
    Dummy.prototype = ctor.prototype;

    return function(/* args... */) {
      if (!curried) {
        curried = me.resolveArgs(ctor, extraArgs, true);
      }

      var instance = new Dummy;
      func.apply(instance, insertArgs(curried, arguments));
      return instance;
    }
  };


  // Registration

  Injector.prototype.value = function(name, val) {
    this.values[this.checkNotRegistered(name)] = val;
    return this;
  };

  Injector.prototype.provider = function(name, val) {
    this.providers[this.checkNotRegistered(name)] = val;
    return this;
  };

  /** Delegates to either .value or .provider depending on arg type */
  Injector.prototype.register = function(name, valOrFunc) {
    if (typeof valOrFunc === 'function') {
      return this.provider(name, valOrFunc);
    } else {
      return this.value(name, valOrFunc);
    }
  };

  Injector.prototype.load = function(map) {
    for (var k in map) {
      this.register(k, map[k]);
    }
    return this;
  };


  // Helpers

  Injector.prototype.resolveArgs = function(func, extras, optional) {
    var names = this.annotate(func);
    var args = Array(names.length);
    var len = names.length;

    // Duplicate loop, pull if stmt out of loop for speed.
    if (extras) {
      for (var i = 0; i < len; i++) {
        var name = names[i];
        args[i] = extras.hasOwnProperty(name) ? 
            extras[name] : this.get(name, optional);
      }
    } else {
      for (var i = 0; i < len; i++) {
        args[i] = this.get(names[i], optional);
      }
    }

    return args;
  };

  /**
   * func - function or name of function
   */
  Injector.prototype.asFunction = function(func) {
    if (!func) {
      throw new Error("Function not provided");
    }
    if (typeof func === 'string') {
      func = this.rawGet(func);
      if (!func) {
        throw new Error('Unknown dep name ' + func);
      }
      if (typeof func !== 'function') {
        throw new Error('Dep ' + func + ' does not resolve to a function');
      }
    }
    return func;
  };

  Injector.prototype.checkNotRegistered = function(name) {
    if (this.localHas(name)) {
      throw new Error("Already registered " + name + 
        " - create a child injector to override a dependency");
    }
    return name;
  };

  Injector.prototype.localGet = function(name) {
    if (this.values.hasOwnProperty(name)) {
      return this.values[name];
    }
    if (this.providers[name]) {
      var ret = this.values[name] = this.invoke(this.providers[name], null);
      if (ret === void 0) {
        throw new Error('provider returned undefined for ' + name);
      }
      return ret;
    }
    return void 0;
  };

  /**
   * Gets the "raw" dep info, so, for values, the value, but
   * for providers, the actual provider.  Does not resolve anything.
   */
  Injector.prototype.rawGet = function(name) {
    var val = this.localRawGet(name);
    if (this.parent) {
      return this.parent.rawGet(name);
    }
    return void 0;
  };

  Injector.prototype.localRawGet = function(name) {
    // Try providers first, because we cache vals,
    // so this way we get the original raw value always.
    var val = this.providers[name];
    if (val !== void 0) {
      return val;
    }

    val = this.values[name];
    if (val !== void 0) {
      return val;
    }

    return void 0;
  };

  Injector.prototype.has = function(name) {
    return this.has(name) || (this.parent ? this.parent.has(name) : false);
  };

  Injector.prototype.localHas = function(name) {
    return this.localRawGet(name) !== void 0;
  };

  Injector.providerOfDep = function(name) {
    return function($injector) {
      return $injector.get(name);
    };
  };

  /**
   * Helper to map dependency names
   *
   * e.g. registering mapped providers of
   * { foo: 'bar' } means that if someone has
   * "foo" as their input, then it will resolve
   * to 'bar'.  This is not baked into the injector,
   * the mechanism is provided by this helper function.
   */
  Injector.mappedProviders = function(mappings) {
    var k, providers, v;
    providers = {};
    for (k in mappings) {
      v = mappings[k];
      providers[k] = Injector.providerOfDep(v);
    }
    return providers;
  };

  Injector.wrapAngular = function($injector) {
    function Adaptor() {
      this.get = function(name, optional) {
        if (optional) {
          return this.has(name) ? $injector.get(name) : void 0;
        } else {
          return $injector.get(name);
        }
      };

      // Won't support getting raw factories/providers, but
      // it's the best we can do.
      this.rawGet = function(name) {
        return this.get(name, true);
      }
    }
    Adaptor.prototype = $injector;
    return new Injector(new Adaptor);
  };

  if (typeof exports === 'undefined') {
    this['heroin'] = {Injector: Injector};
  } else {
    module.exports = Injector;
  }
})();
