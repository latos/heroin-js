Injector = require('./heroin');
coffee = require('coffee-script');

function fail(msg) {
  throw new Error(msg || 'fail');
};

describe('Injector', function() {

  it('injects values', function() {
    var inj = new Injector();
    inj.value('foo', 5);

    var invoked = false;
    inj.invoke(function(foo) {
      invoked = true;
      expect(foo).toBe(5);
    });

    expect(invoked).toBe(true);
  });

  it('fails if no value available', function() {
    var inj = new Injector();
    inj.value('foo', 5);

    var invoked = false;
    try {
      inj.invoke(function(bar) { invoked = true; });
      fail();
    } catch (e) {
      expect(invoked).toBe(false);
      // ok
    }
  });

  it('instantiates instances', function() {
    var inj = new Injector();
    inj.value('foo', 5);

    function MyClass(foo) {
      this.x = foo + 5;
    };

    var obj = inj.instantiate(MyClass);
    expect(obj.x).toBe(10);
  });

  it('applies "this" in invoke', function() {
    var inj = new Injector();
    inj.value('foo', 'hello');

    var invoke = inj.get('invoke');

    var obj = { x: '!!' };

    function func(foo, bar) { return foo + ' ' + bar + this.x; }

    expect(inj.invoke(func, obj, { bar:'there' })).toBe('hello there!!');
    expect(    invoke(func, obj, { bar:'there' })).toBe('hello there!!');
  });

  it('resolves providers once', function() {
    var n = 0;
    var inj = new Injector();
    inj.value('foo', 5);
    inj.provider('bar', function(foo) {
      n++;
      return 'x' + foo;
    });

    var invoked = false;
    function func(bar) {
      expect(bar).toBe('x5');
      invoked = true;
    }
    inj.invoke(func);

    expect(invoked).toBe(true);
    expect(n).toBe(1);

    inj.invoke(func);
    expect(n).toBe(1); // still 1.
  });

  it('inherits from parent', function() {
    var n = 0;
    var inj = new Injector();
    inj.value('foo', 5);
    inj.provider('bar', function(foo) {
      n++;
      return 'x' + foo;
    });

    var child = inj.child();
    child.value('childVal', 7);

    var invoked = false;
    function func(bar, childVal) {
      expect(bar).toBe('x5');
      expect(childVal).toBe(7);
      invoked = true;
    }
    child.invoke(func);

    expect(invoked).toBe(true);
    expect(n).toBe(1);
  });

  it('resolves coffeescript @names', function() {
    // Coffee script occasionally decides to add
    // various name munging strategies - let's track
    // the latest version in our package.json and
    // see if these simple tests ever break.

    var Foo = coffee.eval('class Foo\n  constructor:(@bar)->');

    inj = new Injector();
    make = inj.make;

    make.value('bar', 5);

    foo = make(Foo);
    expect(foo.bar).toBe(5);

    foo = make(Foo, {bar: 6});
    expect(foo.bar).toBe(6);
  });

  it('supports has() detection of deps without evaluating', function() {
    var di = new Injector();

    var ranProvider = false;

    di.load({foo: function() {
      ranProvider = true;
      return 3;
    }});
    var di1 = di.child();
    var di2 = di.child({bar: function() {
      ranProvider = true;
      return 5;
    }});

    expect(di.has('foo')).toBe(true);
    expect(di.has('bar')).toBe(false);

    expect(di1.has('foo')).toBe(true);
    expect(di1.has('bar')).toBe(false);

    expect(di2.has('foo')).toBe(true);
    expect(di2.has('bar')).toBe(true);

    expect(ranProvider).toBe(false);

    expect(di2.get('bar')).toBe(5);
    expect(ranProvider).toBe(true);

    ranProvider = false;
    expect(di1.get('foo')).toBe(3);
    expect(ranProvider).toBe(true);
  });

  it('supports custom annotators passing injector as "this"', function() {

    // Example implementation of an "optional_" prefix.

    var PREFIX = 'optional_', PREFIX_LEN = PREFIX.length;
    function useOptional(name) {
      if (name.substr(0, PREFIX_LEN) == PREFIX) {
        name = name.substr(PREFIX_LEN);
        return this.has(name) ? name : '_NULL_';
      }
      return name;
    }


    var di = new Injector();
    di.annotate = Injector.transformingAnnotator(useOptional, di.annotate);

    di.value('_NULL_', null);

    var di1 = di.child();
    var di2 = di.child({bar: 5});

    var bar1, bar2;

    di1.invoke(function(optional_bar) {
      bar1 = optional_bar;
    });

    di2.invoke(function(optional_bar) {
      bar2 = optional_bar;
    });

    expect(bar1).toBe(null);
    expect(bar2).toBe(5);
  });

  it('convokes with provided args in new child scope', function() {

    var di = new Injector();

    function func1 (di) {
      di.convoke(func2, null, {foo: 5});
    };
    function func2 (di) {
      di.invoke(func3);
    };
    function func3 (foo) {
      expect(foo).toBe(5);
    };

    di.invoke(func1);
  });

});

