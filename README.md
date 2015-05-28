Scope-based injection framework
===============================

- Object life-cycle is not purely global - providers and objects can exist in nested "scopes" that hang off parent scopes.
- Very useful for building complex UIs or for request-scope handling on a server.

Configuration
-------------

Trivial boring example that doesn't do anything you haven't seen before:

```
var injector = new Injector();

injector.load({
  // Simple value
  foo: 5,

  // Provider function - bar is the result of recursively injecting
  bar: function(foo) {
    return foo + 7;
  }

});

function MyConstructor(foo, bar) {
  this.foo = foo;
  this.bar = bar;
};

// Equivalent to new MyConstructor(5, 12);
var thing = injector.make(MyConstructor);

console.log(thing.foo); // etc...

```

A much more interesting is the fact that you can have child scopes:

```

var childInjector = injector.child({ 
  // new value in this injection scope
  bob: 'sup',

  // shadow bar with new value
  bar: 100 

  // foo is inherited from parent
});

function MyConstructor2(foo, bar, bob) {
}

// couldn't use injector, no "bob" available.
childInjector.make(MyConstructor2);

```

Make
----

This is the thing you really want.

The make function does two simple things in one go, the combination is very powerful:
- creates a child scope with the extra arguments loaded in
- instantiates the given class, if any "make" is injected then **it belongs to the child scope**

For simple bits of functionality, we love closures because lexical scoping makes relevant
variables available in our nested scopes, without having to do a lot of boilerplate to
shuffle them around.

When our code grows and we want to split our functions/controllers/classes/whatever across
files, we lose our lovely nested lexical scoping.  Thing of "make" as giving it back,
it is "distributed lexical scoping".  We can't get this from one top-level injector scope,
but we can get it with our child scopes, which make wires does automatically.

Basically, think of `make` as a `new` operator on steroids.  It:
- avoids boilerplate by giving you "lexical scoping across files"
- is quite nice anyway because it gives you named arguments (instead of positional)

```

var make = new Injector().load({
  userService: ....
  theme: 'red'
}).make;


function UserListWidget(make, userService, ...) {

  var onSelectUser = function(userId) {
    var userEditor = make(EditUserWidget, {
        // Configure a new parameter, which will be available to construct
        // EditUserWidget, but also any children that it makes.
        userId: userId

        // userService will be available to the child
        // because it's already in our make's scope.
      })
  }

}

function Child(make, userId, userService) {

  // For Foo, userId (and userService, etc) will be available, because the
  // make instance we've got here is in the scope that injected this constructor.
  var foo = make(Foo, { ... more stuff });
}

```

In coffeescript, make is very pretty:

```
var foo = make Foo,
            bar: 5,
            thing: 'thing'
            
# or
var foo = make Foo, bar: 5, thing: 'thing'
```


Misc
----

There are various other helper configuration methods, curry helpers, factory creators, etc.
As well as `make` for constructing, `injector.invoke` will inject a function without calling `new`,
and methods like `get` and `has` can inspect an injector - but if you find yourself using these
a lot then you're probably doing it wrong.

TODO: document all the various cool helper utilities and tricks available.

But once you get the idea, **`make` gives you 98% of what you want to write clear, boiler-plate free code.**


