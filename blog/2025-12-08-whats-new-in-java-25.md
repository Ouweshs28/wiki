---
slug: whats-new-in-java-25
title: "What’s New in Java 25"
authors: [ouwesh]
tags: [java, java-25, jvm, language-features]
date: 2025-12-08
---

Java 25 continues the recent Java trend: fewer flashy features, more small, sharp tools that make everyday code safer, faster, and easier to reason about.

In this post we’ll look at:

- **simpler `main` and `java.lang` usage**  
- **constructor “prologues” and inheritance**  
- **`ScopedValue` vs `ThreadLocal`**  
- **runtime & performance improvements**  
- **`_` as an unnamed parameter/pattern**  
- **sealed types with safer `switch`**  
- **gatherers: custom intermediate stream operations **

---

<!-- truncate -->

## 1. Simpler `main` and `java.lang` Imports

For teaching and small examples, classic Java is noisy:

```java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, world");
    }
}
```

In modern Java (and especially in single-file programs / REPL / scripting scenarios), the mental model is much simpler:

```java
void main() {
    String name = IO.readln("Enter your name: ");
    IO.println("Hello " + name);
}
```

Key idea:

- types from `java.lang` (`String`, `System`, `Integer`, etc.) are implicitly available
- small snippets and demos can skip a lot of ceremony

In real applications you still provide a proper `public static void main(String[] args)`, but for learning and quick experiments, Java looks much less intimidating.

---

## 2. Constructors, Inheritance, and “Prologues”

Java enforces a strict rule for constructors:

- every constructor must call **either** `this(...)` or `super(...)`  
- that call must be the **first statement**  
- `super(...)` must run before the subclass can fully use `this`

Example:

```java
public class Name {
    protected final String firstName, lastName;

    Name(String firstName, String lastName) {
        this.firstName = firstName;
        this.lastName  = lastName;
    }

    Name(String firstName, String lastName, String middleName) {
        this(firstName + " " + middleName, lastName);
    }
}

class ThreePartName extends Name {
    private final String middleName;

    ThreePartName(String firstName, String lastName, String middleName) {
        super(firstName, lastName, middleName);
        this.middleName = middleName;
    }
}
```

This design ensures the superclass is fully initialized before subclass code runs. Safe, but sometimes **awkward**:

- duplicate **argument validation**  
- duplicate **field assignments**  
- constructors whose main job is just to forward arguments (`this(...)`)  
- pressure to replace constructors with **static factory methods** when bodies get complex

### Thinking in “Prologue → Chain → Epilogue”

A useful way to reason about constructors is to split them conceptually:

```java
Constructor(...) {
    // prologue: validate arguments, prepare values
    // this(...) or super(...): constructor chaining
    // epilogue: additional setup
}
```

Rules of thumb:

- **Prologue**
  - can validate and transform arguments
  - can assign fields (careful: don’t use `this` in a way that assumes full initialization)
- **Chaining**
  - must still be the first *actual* statement (`this(...)` or `super(...)`)
- **Epilogue**
  - runs after superclass is initialized
  - safe to use `this` in full

Concrete example with argument checks:

```java
class ThreePartName extends Name {
    private final String middleName;

    ThreePartName(String firstName, String lastName, String middleName) {
        // prologue: validate args
        requireNonNullOrEmpty(firstName, "firstName");
        requireNonNullOrEmpty(lastName, "lastName");
        requireNonNullOrEmpty(middleName, "middleName");

        // constructor chaining
        super(firstName, lastName, middleName);

        // epilogue: own fields
        this.middleName = middleName;
    }

    private static void requireNonNullOrEmpty(String value, String label) {
        if (value == null) {
            throw new IllegalArgumentException(label + " cannot be null");
        }
        if (value.isEmpty()) {
            throw new IllegalArgumentException(label + " cannot be empty");
        }
    }
}
```

You still obey the same language rules, but the *style* becomes clearer and easier to reason about.

---

## 3. Per-Thread Data: From `ThreadLocal` to `ScopedValue`

Sometimes data:

- is **specific to a thread** (e.g. request id, security context)  
- should be accessible across many layers  
- shouldn’t be threaded through every single method signature

### The Old Way: `ThreadLocal`

```java
static final ThreadLocal<Integer> ANS = new ThreadLocal<>();

void main() {
    ANS.set(11);
    IO.println(ANS.get()); // 11

    new Thread(() -> {
        IO.println(ANS.get()); // null, not set here
    }).start();

    IO.println(ANS.get()); // still 11
}
```

Problems:

- must be **cleaned up manually** (`remove()`), or values can leak across tasks  
- data flow is **two-way and implicit**  
- inheritance to child threads can be **expensive and subtle**

### The New Way: `ScopedValue`

`ScopedValue` gives you a structured way to pass read‑only data down the call stack and across threads:

```java
static final ScopedValue<Integer> ANS = ScopedValue.newInstance();

void main() {
    ScopedValue
        .where(ANS, 11)
        .run(() -> IO.println(ANS.get()));  // prints 11

    ANS.get(); // throws NoSuchElementException – out of scope
}
```

Key properties:

- value is **only available inside** the `run` block  
- **one-way** data flow: you set it once per scope  
- inheriting data to child threads is **cheap** and well-defined  
- still need normal thread-safety for any shared mutable state you use

A more realistic example: request IDs for logging.

```java
static final ScopedValue<String> REQUEST_ID = ScopedValue.newInstance();

void handleRequest(String requestId) {
    ScopedValue.where(REQUEST_ID, requestId)
        .run(this::processRequest);
}

void processRequest() {
    log("starting");
    compute();
    log("finished");
}

void compute() {
    log("in compute");
}

void log(String msg) {
    IO.println("[" + REQUEST_ID.get() + "] " + msg);
}
```

Every log line automatically gets the right request id, without manually threading it through method parameters.

---

## 4. Runtime & Performance Improvements

Java 25 also brings under‑the‑hood tweaks you mostly “just get for free”:

- **Ahead‑of‑Time (AOT) Compilation Cache**  
  - record class loading and profiling during a *training* run  
  - reuse that data in production to improve **startup** and **warm‑up** times

- **Compact Object Headers**  
  - 64‑bit object headers shrink from 12 bytes to 8 bytes  
  - reduces **memory footprint**  
  - may improve CPU/cache behavior for object‑heavy workloads

- **Generational ZGC (default)**  
  - ZGC now uses generational mode by default  
  - better handling of short‑lived vs long‑lived objects  
  - improved **pause times** and **memory usage**, especially in backend services

You usually don’t change application code for these; they’re VM enhancements that make existing code run better.

---

## 5. Underscore `_` as Unnamed Parameter / Pattern

Java 25 makes `_` useful when you don’t care about a value:

### Unused Lambda Parameters

```java
BiConsumer<String, Double> printNameOnly = (name, _) -> {
    System.out.println("Name: " + name);
};
```

The underscore clearly expresses: “yes, there is a parameter here, and I’m intentionally ignoring it”.

### Unused Components in Patterns

```java
if (obj instanceof User(var name, _)) {
    System.out.println("Hello " + name);
}
```

We match a `User`, extract the `name`, and ignore the other component.

### Unused Value in `switch`

```java
switch (obj) {
    case User  _ -> userCount++;
    case Admin _ -> adminCount++;
    default      -> {/* ignore others */}
}
```

Again, `_` documents the intention: we care about the *type*, not the inner data.

---

## 6. Sealed Types and Safer `switch` 

Sealed types limit which classes can implement or extend a type.

```java
public sealed interface PaymentEvent
    permits CardPayment, BankTransfer, Refund, FailedPayment {
}

public final class CardPayment    implements PaymentEvent { /* ... */ }
public final class BankTransfer   implements PaymentEvent { /* ... */ }
public final class Refund         implements PaymentEvent { /* ... */ }
public final class FailedPayment  implements PaymentEvent { /* ... */ }
```

Now say we want to categorize events:

```java
public enum Category { SUCCESS, FAILURE, OTHER }
```

### Exhaustive `switch` Over Sealed Types

```java
public Category categorize(PaymentEvent event) {
    return switch (event) {
        case CardPayment    cp -> Category.SUCCESS;
        case BankTransfer   bt -> Category.SUCCESS;
        case Refund         rf -> Category.OTHER;
        case FailedPayment  fp -> Category.FAILURE;
    };
}
```

Because `PaymentEvent` is sealed and we handle every permitted subtype, this switch is **exhaustive**. If we add a new subtype, the compiler will complain until we handle it.

### Why `default` Is Risky

Compare with a `default` branch:

```java
public Category categorize(PaymentEvent event) {
    return switch (event) {
        case CardPayment  cp -> Category.SUCCESS;
        case BankTransfer bt -> Category.SUCCESS;
        default               -> Category.OTHER;
    };
}
```

Later, we add:

```java
public final class FailedPayment implements PaymentEvent { /* ... */ }
```

The compiler is still happy, but `FailedPayment` now silently falls into `default -> Category.OTHER`, which is wrong.

### Java 22+ with `_`: Explicit “Defaulty” Behavior

Using `_`, we can combine some cases while staying exhaustive:

```java
public Category categorize(PaymentEvent event) {
    return switch (event) {
        case CardPayment  _ -> Category.SUCCESS;
        case BankTransfer _ -> Category.SUCCESS;
        case Refund       _, FailedPayment _ -> Category.OTHER;
    };
}
```

Now:

- `Refund` and `FailedPayment` share the same handling (`Category.OTHER`)  
- if we add another subtype, the compiler **forces** us to add a branch

You get explicit control and better maintainability than with a generic `default`.

---

## 7. Gatherers: Custom Intermediate Stream Operations

Streams have two big families of operations:

- **intermediate**: `map`, `filter`, `flatMap`, `distinct`, …  
- **terminal**: `forEach`, `collect`, `reduce`, `toList`, …

We have **collectors** as a general framework for terminal operations. But until now we didn’t have a similar generalization for intermediate ones.

What if we want:

- fixed‑size batches (`["a","b","c"]`, then `["d","e"]`, …)  
- scans (running totals)  
- “take while including the element that breaks the predicate”  
- sliding windows, etc.?

These don’t fit nicely into existing built‑ins alone.

### Enter Gatherers

Gatherers generalize intermediate operations:

- you define:
  - **state** type (what you keep between elements)
  - an **integrator** to combine `(state, element)` and decide what to emit
  - optional **initializer** (create initial state)
  - optional **finisher** (emit any remaining results at the end)
  - optional **combiner** (for parallel execution)

- you use them via `stream.gather(myGatherer)`.

It’s the intermediate‑ops analog of `collect()` + collectors.

---

### 7.1. Reimplementing `map` as a Gatherer

To see the shape, let’s re‑express `map`:

```java
static <T, R> Gatherer<T, ?, R> map(Function<T, R> f) {
    Integrator<Void, T, R> integrator = (_, element, downstream) -> {
        R mapped = f.apply(element);
        return downstream.push(mapped);
    };

    return Gatherer.of(integrator);
}
```

- no state (`Void`)  
- each input element → exactly one output element  
- good mental model for how gatherers work

---

### 7.2. Fixed-Size Batches

Now a more realistic and easier‑to‑understand example than sliding windows.

Imagine you have log lines and want to send them to an external service in **batches of N**:

Input:

```text
"line1", "line2", "line3", "line4", "line5"
```

With batch size `3`, you want:

```text
["line1", "line2", "line3"],
["line4", "line5"]
```

#### Implementing `batches(int size)`

```java
static <T> Gatherer<T, ?, List<T>> batches(int size) {
    // state: the current partially filled batch
    Supplier<List<T>> initializer = ArrayList::new;

    Integrator<List<T>, T, List<T>> integrator = (batch, element, downstream) -> {
        batch.add(element);

        // if batch is not full yet, keep going, emit nothing
        if (batch.size() < size) {
            return true;
        }

        // batch is full => emit a copy, then clear
        List<T> fullBatch = List.copyOf(batch);
        batch.clear();
        return downstream.push(fullBatch);
    };

    // when the stream ends, emit any leftover elements
    BiConsumer<List<T>, Downstream<List<T>>> finisher = (batch, downstream) -> {
        if (!batch.isEmpty()) {
            downstream.push(List.copyOf(batch));
        }
    };

    return Gatherer.ofSequential(initializer, integrator, finisher);
}
```

#### Using `batches`

```java
List<String> logs = List.of("line1", "line2", "line3", "line4", "line5");

List<List<String>> result = logs.stream()
    .gather(batches(3))
    .toList();
```

`result` is:

```text
[["line1", "line2", "line3"], ["line4", "line5"]]
```

This is a very common pattern:

- state = “current batch”  
- integrator = “add element; if batch is full, emit it”  
- finisher = “if we end with a partial batch, emit it too”

And now it’s reusable and composable with all other stream operations.

---

### 7.3. Running Totals (`scanSum`)

Another simple gatherer: running totals (prefix sums).

Input: `1, 2, 3, 4`  
Output: `1, 3, 6, 10`

```java
static Gatherer<Integer, ?, Integer> scanSum() {
    Supplier<Integer> initializer = () -> 0;

    Integrator<Integer, Integer, Integer> integrator = (sum, element, downstream) -> {
        int newSum = sum + element;
        downstream.push(newSum);
        return true;
    };

    return Gatherer.ofSequential(initializer, integrator);
}
```

Usage:

```java
List<Integer> nums = List.of(1, 2, 3, 4);

List<Integer> running = nums.stream()
    .gather(scanSum())
    .toList();
// [1, 3, 6, 10]
```

This is effectively `scan` from functional programming, now available as a reusable building block in the stream pipeline.

---