---
slug: spring-dependency-injection
title: "Dependency Injection in Spring: @Autowired vs Constructor-Based Injection"
authors: [ouwesh]
tags: [spring, java, dependency-injection, best-practices]
---

In Spring Framework, dependency injection (DI) is a fundamental concept that allows for the creation of loosely coupled components. Two common methods for DI are using the `@Autowired` annotation and constructor-based injection. This article explores when to use each method.

<!-- truncate -->

## @Autowired Annotation

`@Autowired` is a Spring annotation used for automatic dependency injection. It can be applied to fields, setters, and constructors.

### When to Use @Autowired:

1. **Field Injection:**
   - Quick Prototyping: Ideal for rapid development and prototyping.
   - Legacy Code: Useful when integrating DI into existing codebases without significant refactoring.
   - Simplicity: Reduces boilerplate code by directly injecting dependencies into fields.

```java
@Autowired
private MyService myService;
```

2. **Setter Injection:**
   - Optional Dependencies: Suitable for optional dependencies that can be set post-construction.
   - Bean Reconfiguration: Allows for changing dependencies without altering the constructor.

```java
@Autowired
public void setMyService(MyService myService) {
    this.myService = myService;
}
```

**Good Example of @Autowired:**
```java
@Component
public class MyComponent {
    @Autowired
    private MyService myService;
    
    public void performAction() {
        myService.execute();
    }
}
```

**Bad Example of @Autowired:**
```java
@Component
public class MyComponent {
    @Autowired
    private MyService myService;
    
    @Autowired
    private AnotherService anotherService;
    // Too many dependencies injected via fields can make the class hard to test and maintain
}
```

## Constructor-Based Injection

Constructor-based injection involves passing dependencies through a class constructor. This method is recommended for several reasons.

### When to Use Constructor-Based Injection:

1. **Mandatory Dependencies:**
   - Required Dependencies: Ensures that all required dependencies are provided at object creation time.
   - Immutability: Promotes immutability by making dependencies final.

```java
public class MyClass {
    private final MyService myService;
    
    public MyClass(MyService myService) {
        this.myService = myService;
    }
}
```

2. **Testability:**
   - Unit Testing: Facilitates easier unit testing by allowing dependencies to be injected via constructors.
   - Mocking: Simplifies the use of mock objects in tests.

3. **Clear Dependencies:**
   - Explicit Dependencies: Makes dependencies explicit, improving code readability and maintainability.
   - Avoids Reflection: Does not rely on reflection, which can be beneficial for performance and simplicity.

**Bad Example: Circular Dependencies**
```java
@Component
public class ComponentA {
    @Autowired
    private ComponentB componentB;
}

@Component
public class ComponentB {
    @Autowired
    private ComponentA componentA;
}
// Circular dependencies can lead to issues during bean initialization
```

**Bad Example: Field Injection in Non-Spring Managed Classes**
```java
public class NonSpringClass {
    @Autowired
    private MyService myService;
    
    public void performAction() {
        myService.execute();
    }
}
// @Autowired will not work here because NonSpringClass is not managed by Spring
```

**Bad Example: Optional Dependencies (with Constructor Injection)**
```java
@Component
public class MyComponent {
    private final MyService myService;
    private final OptionalService optionalService;
    
    @Autowired
    public MyComponent(MyService myService, OptionalService optionalService) {
        this.myService = myService;
        this.optionalService = optionalService;
    }
    
    public void performAction() {
        myService.execute();
        if (optionalService != null) {
            optionalService.execute();
        }
    }
}
// Optional dependencies are better handled with setter injection or @Autowired on fields
```

## Why Prefer Constructor-Based Injection Over @Autowired

### Advantages of Constructor-Based Injection:

1. **Mandatory Dependencies:**
   - Ensures that all required dependencies are provided at object creation time, preventing the object from being in an invalid state.

2. **Immutability:**
   - Promotes immutability by making dependencies final, which can lead to more predictable and thread-safe code.

3. **Testability:**
   - Facilitates easier unit testing by allowing dependencies to be injected via constructors, making it straightforward to use mock objects.

4. **Explicit Dependencies:**
   - Makes dependencies explicit, improving code readability and maintainability. It is clear what dependencies are required for the class to function.

5. **Avoids Reflection:**
   - Does not rely on reflection, which can be beneficial for performance and simplicity.

6. **Single Responsibility Principle:**
   - Encourages adherence to the Single Responsibility Principle by making it clear when a class has too many dependencies, indicating that it might be doing too much.

By preferring constructor-based injection, you can create more robust, maintainable, and testable code.
