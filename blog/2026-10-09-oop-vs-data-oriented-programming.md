---
slug: oop-vs-data-oriented-programming
title: "Choosing Between OOP and Data-Oriented Programming in Java"
authors: [ouwesh]
tags: [java, design-patterns, language-features, best-practices]
date: 2026-10-09
---

Java developers have spent decades learning a reliable reflex: see a variation, create an interface, add implementations, inject the one you need. It is a good reflex. Polymorphism gives us extensibility, keeps dependencies pointed at abstractions, and makes a growing family of behaviors manageable.

It is also possible to turn that reflex into a small framework for a problem that was just a `switch` away from being obvious.

The trouble starts when an object hierarchy is really just data arriving from another system and our application needs to perform a few operations on it. A second hierarchy of strategies, visitors, factories, and registries can preserve the Open/Closed Principle while making the business rule much harder to find. Modern Java gives us another option: model a closed set of data explicitly and use pattern matching to describe what each case means.

In this post we'll look at:

- **Where OOP and polymorphism are still the right tool** -- extensible behavior and stateful domain concepts
- **When a hierarchy becomes accidental complexity** -- especially around third-party types and integration data
- **How records, sealed types, and pattern matching support data-oriented code** -- with compiler-checked handling of every case
- **How to choose without turning the decision into a religious debate** -- based on the direction your system is likely to change

{/* truncate */}

## OOP's Superpower Is Polymorphism

Object-oriented programming is not a mistake that Java is trying to undo. Its most useful feature is polymorphism: code can depend on a stable contract while new implementations can be introduced independently.

Consider a checkout flow. New delivery partners may be added over time, and each partner owns its own pricing rules:

```java
public interface DeliveryQuote {
    Money quoteFor(Order order);
}

public final class CourierDeliveryQuote implements DeliveryQuote {
    @Override
    public Money quoteFor(Order order) {
        // Call the courier API and calculate its quote.
        return Money.of("12.50");
    }
}

public final class StorePickupQuote implements DeliveryQuote {
    @Override
    public Money quoteFor(Order order) {
        return Money.zero();
    }
}

public final class CheckoutService {
    public Money deliveryCost(Order order, DeliveryQuote deliveryQuote) {
        return deliveryQuote.quoteFor(order);
    }
}
```

Adding a new delivery method does not require changing `CheckoutService`. That is a real benefit, not a design-pattern merit badge. The type family is intentionally open, and each variant brings its own behavior and dependencies.

This is where OOP shines:

- New **kinds of behavior** are expected to appear.
- Each kind owns meaningful state, invariants, collaborators, or lifecycle.
- Clients should ask an object to do work rather than inspect its representation.
- The abstraction is part of a stable extension point, such as a Spring bean interface or plugin API.

The important word is **expected**. An abstraction designed for extension is valuable when extension is likely. Adding interfaces and factories "just in case" is not the same thing.

---

## The Smell: A Parallel Hierarchy Appears

Now consider a different problem. A payment provider gives your application these types:

```java
interface PartnerEvent {}

final class InvoicePaid implements PartnerEvent {
    String invoiceId();
    BigDecimal amount();
}

final class InvoiceRefunded implements PartnerEvent {
    String invoiceId();
    BigDecimal amount();
    String reason();
}
```

Your compliance team asks for an audit record when an invoice payment is at least $10,000 or a refund is at least $5,000. You cannot add an `audit()` method to the provider's classes, and you may need several operations over those events: audit, reporting, notification, and mapping.

The automatic OOP response is often something like this:

```text
PartnerEvent
├── InvoicePaid
└── InvoiceRefunded

EventAudit
├── InvoicePaidAudit
└── InvoiceRefundedAudit
```

Then come a factory or registry to pair an event with its matching audit implementation. The code may use reflection, conventions in class names, `instanceof`, or a map keyed by class. It looks extensible because a future event gets a future audit class.

But step back and ask what changed. We did not discover a new domain abstraction. We created a second hierarchy solely because our code needs to look at data from the first one.

That costs more than a few extra files:

- The business rule is scattered between implementations and the lookup mechanism.
- A missing handler is easy to discover at runtime rather than during compilation.
- A developer has to trace several types to answer a simple question: "What happens for a large refund?"
- Every additional operation can create another parallel hierarchy.

Patterns such as Visitor and Strategy are useful in the right context. They are not a requirement whenever two types exist. If the behavior is local, the variants are known, and the values are primarily data, a direct description of the cases is often easier to read and safer to change.

---

## Data-Oriented Programming: Put the Cases in One Place

In this context, data-oriented programming means organizing an operation around the shape and type of data it receives. It does **not** mean the cache-focused, entity-component-system style of data-oriented design used in game engines. The goal here is to make a known data family and the operation over it explicit.

Java's records, sealed types, and pattern matching make that approach much more compelling than a chain of casts.

First, model the events as an intentionally closed family:

```java
sealed interface PartnerEvent permits InvoicePaid, InvoiceRefunded {}

record InvoicePaid(String invoiceId, BigDecimal amount)
        implements PartnerEvent {}

record InvoiceRefunded(String invoiceId, BigDecimal amount, String reason)
        implements PartnerEvent {}
```

Then express the audit rule where a reader expects to find it:

```java
private static final BigDecimal LARGE_PAYMENT = new BigDecimal("10000");
private static final BigDecimal LARGE_REFUND = new BigDecimal("5000");

String auditMessage(PartnerEvent event) {
    return switch (event) {
        case InvoicePaid paid
                when paid.amount().compareTo(LARGE_PAYMENT) >= 0 ->
            "Audit payment for invoice " + paid.invoiceId();

        case InvoicePaid paid ->
            "";

        case InvoiceRefunded refund
                when refund.amount().compareTo(LARGE_REFUND) >= 0 ->
            "Audit refund for invoice " + refund.invoiceId()
                    + ": " + refund.reason();

        case InvoiceRefunded refund ->
            "";
    };
}
```

There is no factory, no class-name convention, and no handler hidden elsewhere. The rule says exactly what the business asked for:

1. A large payment gets audited.
2. A large refund gets audited.
3. Other events do not create an audit message.

That directness is a feature. A product owner or another engineer can review the rule without reconstructing a dispatch mechanism in their head.

### Sealed types turn change into compiler feedback

The `switch` has no `default` branch because `PartnerEvent` is sealed. Java knows that `InvoicePaid` and `InvoiceRefunded` are the only permitted implementations, so it can verify that the expression is exhaustive.

If the provider later introduces `InvoiceDisputed`, adding it to the permits list makes relevant switches fail to compile until they decide what to do with the new case. That is far better feedback than a production alert caused by a registry entry that was never added.

Do not add a catch-all `default` merely to silence the compiler. A default branch is appropriate when unknown values have a deliberate, correct fallback. It is harmful when a new domain case needs a business decision. Let the compiler make that missing decision visible.

---

## The Trade-off Did Not Disappear

The pattern-matching version modifies an existing operation when a new event type is added. That means it is not as open to new variants as the interface-and-implementation approach.

That is not automatically a loss.

Every design pays somewhere:

| Change you expect most often | Better default | Why |
|---|---|---|
| New implementations of one stable behavior | Polymorphism | A new class can satisfy the existing contract without changing callers. |
| New operations over a stable family of values | Data-oriented code | Each operation can clearly handle all known variants in one place. |
| State, invariants, and collaboration belong to each variant | OOP | Behavior stays next to the data it protects. |
| DTOs, events, parsed input, or third-party values need local handling | Data-oriented code | The application owns the operation, not the external type hierarchy. |
| Both types and operations grow independently | Reconsider the boundary | Either design may become expensive; split the model or isolate the volatile parts. |

The Open/Closed Principle is guidance for managing change, not a law that makes every modification wrong. A two-line, compiler-enforced addition to an explicit switch can be less costly than a hierarchy whose only job is avoiding that modification.

---

## Records Make Data Intentional

Records make a useful distinction visible in the type system. A record says, "this value is primarily its components." That is exactly what integration events, API payloads, query results, and many value objects are.

With record patterns, available in Java 21, a rule can destructure only the values it needs:

```java
String auditMessage(PartnerEvent event) {
    return switch (event) {
        case InvoicePaid(String invoiceId, BigDecimal amount)
                when amount.compareTo(LARGE_PAYMENT) >= 0 ->
            "Audit payment for invoice " + invoiceId;

        case InvoiceRefunded(String invoiceId, BigDecimal amount, String reason)
                when amount.compareTo(LARGE_REFUND) >= 0 ->
            "Audit refund for invoice " + invoiceId + ": " + reason;

        case InvoicePaid paid ->
            "";

        case InvoiceRefunded refund ->
            "";
    };
}
```

This is not permission to turn every class into a record. Records are a poor fit for mutable entities, framework proxies, or objects whose identity and behavior are more important than the values they contain. They are excellent when immutability and transparent state are the point.

For background on the language support, see [sealed classes](https://openjdk.org/jeps/409), [record patterns](https://openjdk.org/jeps/440), and [pattern matching for `switch`](https://openjdk.org/jeps/441).

---

## Keep Both Styles in the Same Application

The strongest Java applications use both approaches without forcing every problem into one camp.

For example, a Spring Boot service might use polymorphism at its extension boundary:

```java
public interface TaxCalculator {
    Money calculateFor(Checkout checkout);
}
```

Country-specific tax calculators can be Spring beans that implement that contract. Each may call a different service, enforce its own rules, and evolve independently. Polymorphism is doing useful work here.

Inside an integration adapter, the same application may receive a fixed set of webhook events and route them with a sealed `switch`. The adapter is translating incoming data into local actions; it does not need an elaborate plugin model to do that safely.

One application, two useful shapes:

```text
Extension point with independently growing behavior  -> polymorphism
Known data family with explicit local operations     -> pattern matching
```

This is not inconsistency. It is choosing the smallest abstraction that matches the direction of change.

---

## Five Questions Before You Add Another Interface

Before adding an interface, strategy, visitor, or factory, ask:

1. **What changes more often: variants or operations?** If new operations arrive more often than new variants, a data-oriented model may be easier to evolve.
2. **Is this an open family or a closed one?** Use sealed types when the set of valid variants is intentionally finite and controlled.
3. **Does each variant own meaningful behavior?** If it only transports values, keeping behavior outside it can be more honest.
4. **Are the values crossing a boundary?** Third-party models, event payloads, and API DTOs are often best handled explicitly in the receiving application.
5. **Will a missing case be safe?** Prefer a compiler error for a new business case over a generic fallback that quietly does the wrong thing.

If the answer is unclear, write a small prototype both ways. The better design is usually the one that makes the next expected change obvious, not the one that contains the most familiar patterns.

---

## Choose the Direction of Change, Not a Side

Polymorphism remains one of Java's best tools for extensible behavior. Data-oriented programming gives us a clear alternative when the real problem is applying operations to a known set of data.

Use OOP when you are creating an extension point. Use records, sealed types, and pattern matching when you are handling a closed family of values. Mix them freely at the boundaries where each makes the code simpler.

The goal is not to prove that one paradigm wins. The goal is code that communicates the business rule, gives useful feedback when the model changes, and does not need a factory to explain a `switch`.

---
