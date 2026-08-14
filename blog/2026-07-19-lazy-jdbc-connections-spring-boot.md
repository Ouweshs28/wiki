---
slug: lazy-jdbc-connections-spring-boot
title: "Lazy JDBC Connections in Spring Boot 4.1 (Performance Win)"
authors: [ouwesh]
tags: [spring-boot, spring, java, jdbc, performance, hibernate, best-practices]
date: 2026-07-19
---

Every time a `@Transactional` method runs in your Spring Boot application, Spring grabs a JDBC connection from the pool. Immediately. Before your code even executes. Before it knows whether you'll actually touch the database. That connection sits there, reserved for you, doing absolutely nothing — while some other thread might be blocked waiting for a free connection. Your Hibernate second-level cache just returned the result from memory? Doesn't matter. Connection was already checked out. That's the equivalent of renting a car to walk across the street.

Spring Boot 4.1 fixes this with first-class support for lazy JDBC connections. One property. Massive performance win.

In this post we'll look at:

- **The problem with eager connections** — why Spring grabs a connection before you need one
- **What `LazyConnectionDataSourceProxy` does** — the mechanism behind lazy fetching
- **Spring Boot 4.1's auto-configuration** — enabling it with a single property
- **Before vs after** — what you had to do manually (and why nobody bothered)
- **Real-world scenarios where this shines** — cache hits, conditional logic, and read/write routing

{/* truncate */}

## The Problem: Connections Are Expensive (And You're Wasting Them)

Here's what happens when you call a `@Transactional` method in a typical Spring Boot application:

1. Spring's transaction interceptor fires **before** your method body runs
2. The `DataSourceTransactionManager` immediately calls `dataSource.getConnection()`
3. A connection is **checked out** from HikariCP (or whatever pool you're using)
4. Your method executes
5. The connection is returned to the pool on commit/rollback

The problem is step 2. The connection is acquired **eagerly** — before Spring has any idea whether your code will actually execute a SQL statement.

### When Eager Connections Hurt

Consider this service method:

```java
@Service
@Transactional(readOnly = true)
public class ProductService {
    private final ProductRepository repository;
    private final CacheManager cacheManager;

    public ProductService(ProductRepository repository, CacheManager cacheManager) {
        this.repository = repository;
        this.cacheManager = cacheManager;
    }

    public Product findById(Long id) {
        Cache cache = cacheManager.getCache("products");
        Product cached = cache.get(id, Product.class);
        if (cached != null) {
            return cached; // Cache hit — never touched the database
        }
        Product product = repository.findById(id).orElseThrow();
        cache.put(id, product);
        return product;
    }
}
```

On a cache hit, this method **never executes a query**. But because the method is `@Transactional`, a JDBC connection was already checked out of the pool before the `if` statement even runs. With a 95% cache hit rate, you're wasting a connection 95% of the time. Under high concurrency, that means threads are blocking on `HikariPool.getConnection()` — not because the database is slow, but because your application is hoarding connections it never uses.

That's like booking a hotel room every morning "just in case" you feel tired, then going home anyway.

---

## The Solution: `LazyConnectionDataSourceProxy`

Spring Framework has had `LazyConnectionDataSourceProxy` since the early days — most developers just didn't know it existed (or couldn't be bothered to wire it up manually).

It wraps your actual `DataSource` and returns a **proxy** `Connection` object. That proxy doesn't fetch a real connection from the pool until the first `Statement` is created. If your transactional method never creates a statement, **no connection is ever acquired**.

Here's what changes:

| Event | Eager (Default) | Lazy (With Proxy) |
|-------|-----------------|-------------------|
| `@Transactional` method called | Connection acquired | Proxy returned (no connection) |
| Cache hit — no SQL executed | Connection wasted ❌ | No connection acquired ✅ |
| SQL statement created | Connection already held | Connection acquired on demand |
| Transaction commits (no SQL) | Empty commit sent to DB | Nothing happens (no connection to commit) |

The proxy also tracks connection settings like auto-commit, read-only mode, and isolation level. When a real connection is finally needed, those settings are applied transparently.

---

## Spring Boot 4.1: One Property, Done

Before Spring Boot 4.1, enabling lazy connections required manual bean configuration. You had to write this yourself:

### The Old Way (Pre-4.1)

```java
@Configuration
public class DataSourceConfig {

    @Bean
    @Primary
    public DataSource lazyDataSource(DataSource actualDataSource) {
        return new LazyConnectionDataSourceProxy(actualDataSource);
    }
}
```

This is straightforward, but there's a catch. You need to be careful about bean ordering, `@Primary` annotations, and not accidentally wrapping the proxy in another proxy. Most teams looked at this, said "seems fine without it," and moved on.

### The New Way (Spring Boot 4.1)

```properties
spring.datasource.lazy-connection=true
```

That's it. Spring Boot 4.1 auto-configures `LazyConnectionDataSourceProxy` for you when this property is set. No manual bean definitions, no bean ordering headaches, no accidentally breaking your `DataSource` configuration.

In YAML:

```yaml
spring:
  datasource:
    lazy-connection: true
```

Spring Boot handles the wrapping correctly — your HikariCP pool is created as usual, then wrapped in the lazy proxy. Everything downstream (JPA, JdbcTemplate, MyBatis) works without changes.

---

## Where Lazy Connections Make a Real Difference

Lazy connections aren't just a theoretical optimization. They produce measurable wins in several common scenarios.

### 1. Hibernate Second-Level Cache Hits

If you're using Hibernate's second-level cache (EhCache, Caffeine, Hazelcast), entities resolved from cache never hit the database. With lazy connections, those cache-served requests never acquire a JDBC connection either:

```java
@Service
@Transactional(readOnly = true)
public class CustomerService {
    private final CustomerRepository repository;

    public CustomerService(CustomerRepository repository) {
        this.repository = repository;
    }

    @Cacheable("customers")
    public Customer findById(Long id) {
        return repository.findById(id).orElseThrow();
    }
}
```

First call: connection acquired, query runs, result cached. Next 99 calls: no connection, no query, no database communication at all.

### 2. Conditional Database Access

Business logic that only touches the database under certain conditions:

```java
@Service
@Transactional
public class NotificationService {
    private final NotificationRepository repository;
    private final RateLimiter rateLimiter;

    public NotificationService(NotificationRepository repository, RateLimiter rateLimiter) {
        this.repository = repository;
        this.rateLimiter = rateLimiter;
    }

    public void sendNotification(String userId, String message) {
        if (!rateLimiter.tryAcquire(userId)) {
            return; // Rate limited — no DB access needed
        }
        repository.save(new Notification(userId, message));
    }
}
```

When the rate limiter rejects the request (which could be 80%+ of calls under load), no connection is consumed.

### 3. Read/Write Routing with `AbstractRoutingDataSource`

This is the killer use case. If you're routing queries to read replicas based on the `readOnly` flag, `LazyConnectionDataSourceProxy` ensures the routing decision happens **after** the transaction's read-only flag is set — not before:

```java
public class ReadWriteRoutingDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
        return TransactionSynchronizationManager.isCurrentTransactionReadOnly()
            ? "replica"
            : "primary";
    }
}
```

Without the lazy proxy, the connection is fetched before the transaction's read-only flag is propagated, and routing decisions may use stale state. With it, the routing happens at the right time — when the connection is actually needed.

---

## Performance Impact: What to Expect

The improvement depends on your application's access patterns:

| Scenario | Connection Pool Pressure Reduction |
|----------|-----------------------------------|
| High cache hit rate (90%+) | **Significant** — most transactions skip the pool entirely |
| Conditional DB access (rate limiting, feature flags) | **Moderate to high** — depends on rejection rate |
| Read/write routing | **Correctness fix** — ensures proper replica routing |
| Every method executes SQL | **Minimal** — lazy proxy adds negligible overhead |

The lazy proxy adds a thin wrapper around each connection. For transactions that always execute SQL, the overhead is a few nanoseconds of indirection — insignificant compared to actual network I/O.

---

## When NOT to Use Lazy Connections

Lazy connections are safe for most applications, but there are edge cases:

- **Connection validation on checkout**: Some pools validate connections when checking them out. With lazy connections, validation is deferred, which could surface stale connection errors later in the request lifecycle. HikariCP handles this well, but check your pool's behavior.
- **Custom `Connection` unwrapping**: If your code calls `connection.unwrap(OracleConnection.class)` or similar vendor-specific unwrapping, you'll get the proxy first. Use `ConnectionProxy` to unwrap correctly.
- **Monitoring tools that count active connections**: Tools that track "connections in use" will show lower numbers (which is accurate — those connections genuinely aren't in use).

---

## Key Takeaways

1. **Spring's default behavior acquires connections eagerly** — before your code runs, regardless of whether SQL is executed.
2. **`LazyConnectionDataSourceProxy` defers connection acquisition** until the first `Statement` is created. No SQL = no connection.
3. **Spring Boot 4.1 auto-configures this** with `spring.datasource.lazy-connection=true`. One property, no manual beans.
4. **Biggest wins come from cache-heavy and conditional-access patterns** where many transactions skip the database entirely.
5. **Read/write routing gets a correctness improvement** because the routing decision happens after the transaction's read-only flag is set.

Stop paying for connections you're not using. Add the property, deploy, and watch your connection pool metrics improve overnight.

---

*Inspired by [Dan Vega's video](https://www.youtube.com/watch?v=lsaBN1U2EB8) on this Spring Boot 4.1 feature.*
