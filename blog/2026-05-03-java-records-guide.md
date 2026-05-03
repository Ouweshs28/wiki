---
slug: java-records-guide
title: "A Practical Guide to Java Records"
authors: [ouwesh]
tags: [java, records, language-features, best-practices, spring-boot]
date: 2026-05-03
---

Java records, introduced in Java 16 (JEP 395), finally let you delete Lombok. You know, that library you added to avoid writing 50+ lines of getters, then spent hours debugging `@Data` annotation conflicts and weird IDE plugin issues. One line. No plugins. No magic. Just the Java compiler doing what it should have done 25 years ago.

In this guide, you'll learn:

- **The problem records solve** — why we needed them
- **Core syntax and features** — compact constructors, immutability, and generated methods
- **Real-world patterns** — DTOs, value objects, projections, and configuration
- **When records fit (and when they don't)** — practical guidance for your codebase

<!-- truncate -->

## The Problem: Boilerplate Kills Productivity (and Your Will to Live)

Before records, a simple data carrier class required 35 lines of soul-crushing boilerplate. Or you added Lombok, then explained to every new hire why they need to install an IDE plugin that randomly stops working after updates:

```java
public final class Customer {
    private final String email;
    private final String fullName;
    private final LocalDate registrationDate;

    public Customer(String email, String fullName, LocalDate registrationDate) {
        this.email = email;
        this.fullName = fullName;
        this.registrationDate = registrationDate;
    }

    public String getEmail() { return email; }
    public String getFullName() { return fullName; }
    public LocalDate getRegistrationDate() { return registrationDate; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Customer customer = (Customer) o;
        return Objects.equals(email, customer.email) && 
               Objects.equals(fullName, customer.fullName) &&
               Objects.equals(registrationDate, customer.registrationDate);
    }

    @Override
    public int hashCode() {
        return Objects.hash(email, fullName, registrationDate);
    }

    @Override
    public String toString() {
        return "Customer{email='" + email + "', fullName='" + fullName + "', registrationDate=" + registrationDate + "}";
    }
}
```

That's **35 lines** to say "I have three fields." Your product manager asks for a new feature and you're over here hand-crafting `hashCode()` implementations like it's 1998. Someone always "helpfully" suggests Lombok, and now you have two problems: the original boilerplate *and* mysterious compile errors when Lombok decides your annotation processor order is offensive to its sensibilities.

### The Record Solution: Lombok's Retirement Party

A record declares immutable data and lets the **Java compiler** — not a third-party annotation processor with opinions about your build tool — generate the rest:

```java
public record Customer(String email, String fullName, LocalDate registrationDate) {}
```

**One line** gives you:

- Private final fields for each component
- A public constructor taking all fields
- Accessor methods (`email()`, `fullName()`, `registrationDate()` — not `getEmail()`)
- `equals()`, `hashCode()`, and `toString()` implementations

The class is implicitly `final`, and the fields are immutable. The compiler handles the tedious parts; you focus on the data structure. No `@Value`. No `@Getter`. No wondering why your debugger shows null fields that definitely had values.

---

## Compact Constructors: Adding Validation

Records support a compact constructor syntax for validation logic. Unlike traditional classes, you don't assign fields manually — the compiler does that after your validation runs.

### Before Records

```java
public class Email {
    private final String value;

    public Email(String value) {
        if (value == null || !value.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")) {
            throw new IllegalArgumentException("Invalid email format");
        }
        this.value = value;
    }
}
```

### With Compact Constructors

```java
public record Email(String value) {
    public Email {
        if (value == null || !value.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")) {
            throw new IllegalArgumentException("Invalid email format");
        }
        // No 'this.value = value' needed — compiler handles it
    }
}
```

The compact constructor runs before field assignment. Your validation logic executes, then the compiler implicitly assigns the parameters to the fields.

---

## Pattern 1: Domain Value Objects

In Domain-Driven Design, value objects are defined by their attributes, not identity. Records are ideal because immutability is the default.

```java
public record Money(BigDecimal amount, Currency currency) {
    public Money {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Amount cannot be negative");
        }
        if (currency == null) {
            throw new IllegalArgumentException("Currency is required");
        }
    }

    public Money add(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new IllegalArgumentException("Cannot add different currencies");
        }
        return new Money(this.amount.add(other.amount), this.currency);
    }

    public Money multiply(int factor) {
        return new Money(this.amount.multiply(BigDecimal.valueOf(factor)), this.currency);
    }
}
```

Notice `add()` and `multiply()` return new instances instead of mutating state. This preserves the value object's integrity.

---

## Pattern 2: API Request/Response DTOs

Records excel as Data Transfer Objects in REST APIs. Jackson (Spring Boot's default JSON library) supports records natively since version 2.12.

### Request DTO with Validation

```java
public record CreateUserRequest(
    @NotBlank(message = "Email is required") String email,
    @Size(min = 2, max = 100, message = "Name must be 2-100 characters") String fullName,
    @Min(value = 18, message = "Must be at least 18") int age,
    @NotNull String department
) {}
```

### Response DTO

```java
public record UserResponse(
    Long id,
    String email,
    String fullName,
    int age,
    String department,
    LocalDateTime createdAt
) {}
```

### Controller Usage

```java
@RestController
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @PostMapping("/api/users")
    public ResponseEntity<UserResponse> create(
        @Valid @RequestBody CreateUserRequest request) {
        UserResponse response = userService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
```

JSON serialization and deserialization work without configuration. Records reduce DTO boilerplate while maintaining full Spring ecosystem compatibility.

---

## Pattern 3: Database Projections with Spring Data

Fetching full entities wastes memory and bandwidth. Records let you define precise projections that map directly to query results.

### Entity with Many Fields

```java
@Entity
public class Employee {
    @Id private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    private String department;
    private BigDecimal salary;
    private LocalDate hireDate;
    private String address;
    private String emergencyContact;
    // ... additional fields
}
```

### Projection Record

```java
public record EmployeeContactInfo(Long id, String firstName, String lastName, String email, String phone) {}
```

### Repository

```java
@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    List<EmployeeContactInfo> findByDepartment(String department);
}
```

Spring Data generates an optimized query:

```sql
SELECT e.id, e.first_name, e.last_name, e.email, e.phone 
FROM employee e 
WHERE e.department = ?
```

Instead of `SELECT *`, the database returns only the five requested columns. This reduces data transfer and memory pressure, especially for wide tables.

---

## Pattern 4: Configuration Properties

Spring Boot 2.6+ supports records for `@ConfigurationProperties`, removing boilerplate from configuration classes.

```java
@ConfigurationProperties(prefix = "notification")
@Validated
public record NotificationConfig(
    @Min(1) @Max(100) int maxRetries,
    @NotBlank String webhookUrl,
    boolean enableSlack,
    Duration retryDelay
) {}
```

Enable configuration properties in your main class:

```java
@SpringBootApplication
@EnableConfigurationProperties(NotificationConfig.class)
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

Access configuration in services:

```java
@Service
@RequiredArgsConstructor
public class NotificationService {
    private final NotificationConfig config;

    public void sendAlert() {
        // Use config.maxRetries(), config.webhookUrl(), etc.
    }
}
```

The record's accessors become the property names. JSR-303 validation annotations work directly on record components.

---

## Pattern 5: Static Factory Methods

Static factory methods improve readability and provide named construction alternatives.

```java
public record DateRange(LocalDate start, LocalDate end) {
    public DateRange {
        if (start.isAfter(end)) {
            throw new IllegalArgumentException("Start date must be before or equal to end date");
        }
    }

    public boolean contains(LocalDate date) {
        return !date.isBefore(start) && !date.isAfter(end);
    }

    public static DateRange thisMonth() {
        LocalDate now = LocalDate.now();
        return new DateRange(now.withDayOfMonth(1), now.withDayOfMonth(now.lengthOfMonth()));
    }

    public static DateRange lastWeek() {
        LocalDate now = LocalDate.now();
        return new DateRange(now.minusWeeks(1), now);
    }
}
```

Usage is self-documenting:

```java
DateRange currentMonth = DateRange.thisMonth();
DateRange previousWeek = DateRange.lastWeek();
```

### Alternative Naming Convention

Some teams prefer factory methods named after the type (first character lowercased). This enables static imports and removes the need to qualify the type:

```java
public record Meetup(String title, LocalDateTime startTime, String location) {
    public Meetup {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Title is required");
        }
    }

    // Factory method named after the type (lower-case first letter)
    public static Meetup meetup(String title, LocalDateTime startTime, String location) {
        return new Meetup(title, startTime, location);
    }

    // Overloaded for common defaults
    public static Meetup meetup(String title, LocalDateTime startTime) {
        return new Meetup(title, startTime, "TBD");
    }
}
```

With static import, usage becomes fluent:

```java
import static com.example.Meetup.meetup;

// No type repetition - reads like natural language
Meetup standup = meetup("Daily Standup", LocalDateTime.of(9, 0));
Meetup review = meetup("Sprint Review", LocalDateTime.of(14, 0), "Conference Room A");
```

This convention works especially well when:
- Multiple value objects exist in the same scope (avoids naming collisions)
- The surrounding context already establishes the domain (e.g., `meetup("title")` is unambiguous in calendar code)
- You want construction to read like a DSL (Domain Specific Language)

---

## Pattern 6: Sealed Classes and Pattern Matching

Records pair naturally with sealed classes for exhaustive pattern matching (finalized in Java 21).

```java
sealed interface PaymentResult permits PaymentApproved, PaymentDeclined, PaymentPending {}

public record PaymentApproved(String transactionId, BigDecimal amount) implements PaymentResult {}
public record PaymentDeclined(String reason, String errorCode) implements PaymentResult {}
public record PaymentPending(String transactionId, Duration estimatedWait) implements PaymentResult {}
```

Exhaustive switch expressions with no default:

```java
public String formatPaymentStatus(PaymentResult result) {
    return switch (result) {
        case PaymentApproved p -> "Approved: " + p.transactionId() + " for " + p.amount();
        case PaymentDeclined d -> "Declined: " + d.reason() + " (Code: " + d.errorCode() + ")";
        case PaymentPending pending -> "Pending: ETA " + pending.estimatedWait().toMinutes() + " min";
    };
}
```

The compiler verifies that all permitted subtypes are handled. Add a new response type, and the compiler flags unhandled switches.

---

## When to Use Records (And When to Avoid Them)

Records fit specific use cases well. Understanding the boundaries prevents inappropriate application.

| Use Case | Records Fit? | Reason |
|----------|--------------|--------|
| Immutable data holders | **Yes** | Core purpose of records |
| Validated value objects | **Yes** | Compact constructors enable validation |
| API request/response DTOs | **Yes** | Native JSON support, minimal boilerplate |
| Database read projections | **Yes** | Efficient selects with type safety |
| Event payloads in messaging | **Yes** | Serializable and inherently immutable |
| Mutable data | **No** | Fields are final by design |
| JPA entities with lazy loading | **No** | Requires proxies and no-arg constructors |
| Complex inheritance hierarchies | **No** | Records cannot extend other classes |

### Guidelines

- **Use records** for configuration, DTOs, value objects, and projections where immutability is desirable.
- **Avoid records** for entities requiring lazy loading, mutable state, or framework proxies that need default constructors.
- **Prefer classes** when you need to extend existing functionality or mutate internal state.

---

## Summary: The Lombok Migration Begins

Java records reduce boilerplate for immutable data carriers. A single line replaces fields, constructor, accessors, `equals()`, `hashCode()`, and `toString()` — without a single `@Data` annotation or IDE plugin dependency.

Records shine in Spring applications as DTOs, configuration properties, and database projections. They integrate with Jackson for JSON, Spring Data for query results, and validation frameworks for input constraints. You can finally remove that Lombok dependency and stop explaining to junior developers why their project won't compile even though "the code looks fine."

Adopt records where immutability fits your design. Recognize their limitations — they are not a replacement for all classes, but they are definitely a replacement for most Lombok usage.
