---
slug: shared-spring-boot-modules
title: "Shared Spring Boot Modules Without the Internal-Framework Trap"
authors: [ouwesh]
tags: [spring-boot, spring, java, maven, testing, best-practices]
date: 2026-08-14
---

Shared code starts with good intentions: stop copying the same tracing setup, validation rules, or test helpers into every service. Then, six months later, you have a mystery JAR that pulls in half of Spring, overrides application beans, and requires a Slack message to configure.

The problem is not sharing code. The problem is treating a shared library as a bucket of reusable classes instead of a product with consumers, compatibility promises, and a sensible onboarding path.

In this post we'll look at:

- **A module layout that keeps framework code contained** — core code stays portable while Spring Boot integration stays convenient
- **Starters and auto-configuration that help instead of hijack** — useful defaults with clear escape hatches
- **Configuration and test support as part of the public API** — discoverable properties and reusable conventions
- **Documentation and releases that scale to more than one project** — fewer archaeology sessions and safer upgrades

<!-- truncate -->

## 1. Start With a Boundary, Not a Dependency

Before creating `company-common`, decide what the module is actually allowed to own. A shared library is a good home for stable, cross-cutting capabilities:

- Observability adapters, security-client primitives, HTTP error conventions, or internal event envelopes
- Reusable test fixtures and architecture rules
- Integration code that every consumer would otherwise configure the same way

It is usually the wrong home for domain workflows, one application's configuration, or a "utilities" package with no ownership. If a change needs agreement from every team before it can ship, that code is probably not a low-level shared abstraction.

The useful question is not "can several projects use this?" It is: **can several projects use this without giving up meaningful control?**

---

## 2. Split Framework Concerns Into Deliberate Modules

A single artifact is tempting, but it makes every consumer pay for every integration. A small module graph gives consumers a clear choice:

```text
acme-delivery/
├── pom.xml
├── delivery-core/
├── delivery-spring/
├── delivery-spring-boot-autoconfigure/
├── delivery-spring-boot-starter/
├── delivery-test/
└── delivery-bom/
```

| Module | Responsibility |
|--------|----------------|
| `delivery-core` | Domain-neutral interfaces, value types, and algorithms. No Spring imports. |
| `delivery-spring` | Spring Framework adapters that do not require Spring Boot. |
| `delivery-spring-boot-autoconfigure` | Conditional beans and `@ConfigurationProperties` for Boot applications. |
| `delivery-spring-boot-starter` | A convenient, opinionated dependency set for the common case. |
| `delivery-test` | Fixtures, assertions, and reusable architecture rules for consumers' tests. |
| `delivery-bom` | Version alignment for the artifacts a client may combine. |

This is not ceremony for its own sake. It preserves important boundaries:

1. A command-line tool can use `delivery-core` without importing a web framework.
2. An application can use one Spring adapter without accepting every default.
3. A typical Spring Boot service can add one starter and get the supported setup.

Your root POM should make those modules consistent: Java version, test conventions, quality plugins, and dependency versions belong there. It should not quietly turn every submodule into a Spring Boot application.

### Keep optional integrations optional

Suppose only some consumers use Micrometer tracing. The auto-configuration module can compile against its API without forcing that library onto all clients:

```xml
<!-- delivery-spring-boot-autoconfigure/pom.xml -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing</artifactId>
    <optional>true</optional>
</dependency>

<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-autoconfigure</artifactId>
</dependency>
```

The starter is where the common, deliberate choice lives:

```xml
<!-- delivery-spring-boot-starter/pom.xml -->
<dependency>
    <groupId>com.acme.platform</groupId>
    <artifactId>delivery-spring-boot-autoconfigure</artifactId>
</dependency>

<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>

<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-otel</artifactId>
</dependency>
```

That split matters. The auto-configuration can adapt to a dependency **when it exists**; the starter makes the dependency part of an explicit, supported setup. Do not expose an optional library's types from `delivery-core`, though. Otherwise consumers can still hit class-loading failures when they use an apparently framework-free API.

---

## 3. Auto-Configure Defaults, Not Handcuffs

[Spring Boot auto-configuration](https://docs.spring.io/spring-boot/reference/features/developing-auto-configuration.html) is ideal for shared modules because it lets the library provide a sensible default while keeping the application in charge.

```java
@AutoConfiguration
@ConditionalOnClass(Tracer.class)
@ConditionalOnProperty(
        prefix = "acme.delivery.observability",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true
)
@EnableConfigurationProperties(DeliveryProperties.class)
public class DeliveryObservabilityAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    DeliveryObservationPublisher deliveryObservationPublisher(
            Tracer tracer,
            DeliveryProperties properties
    ) {
        return new MicrometerDeliveryObservationPublisher(tracer, properties);
    }
}
```

This configuration has three useful properties:

- It activates only when the required integration is present.
- It has an explicit off switch for applications that do not want the behavior.
- An application can replace the default by declaring its own `DeliveryObservationPublisher`.

That last point is the difference between a library and an internal framework. A shared module should provide a paved road, not block every other route.

Register the auto-configuration in the standard Boot imports file:

```text
# src/main/resources/META-INF/spring/
# org.springframework.boot.autoconfigure.AutoConfiguration.imports
com.acme.delivery.autoconfigure.DeliveryObservabilityAutoConfiguration
```

### Use method parameters inside auto-configuration

`@AutoConfiguration` disables proxied `@Bean` methods. Do not call one bean method from another and assume Spring will return the managed singleton. Let Spring resolve dependencies through method parameters instead:

```java
@AutoConfiguration
public class DeliveryAutoConfiguration {

    @Bean
    DeliveryClock deliveryClock() {
        return Clock.systemUTC();
    }

    @Bean
    DeliveryScheduler deliveryScheduler(DeliveryClock deliveryClock) {
        return new DeliveryScheduler(deliveryClock);
    }
}
```

If the application needs different behavior, `@ConditionalOnMissingBean` gives production code a clean override. In a test where both the default and a special test bean must exist, define the test bean with `@Primary`.

Use auto-configuration ordering only when one auto-configuration genuinely depends on another. It should not be a substitute for clear bean conditions or a way to win a bean-definition race.

---

## 4. Treat Properties as a Public API

Configuration is often the first interface a consumer sees. If the IDE cannot explain a property, the documentation is stale, or the defaults are unclear, the module is difficult to adopt even when its Java API is excellent. Spring Boot's [external configuration support](https://docs.spring.io/spring-boot/reference/features/external-config.html) makes this API available through application configuration.

Spring Boot supports immutable configuration records:

```java
@ConfigurationProperties("acme.delivery")
public record DeliveryProperties(
        @DefaultValue("true") boolean enabled,
        @DefaultValue("PT2S") Duration flushInterval,
        @DefaultValue("100") int batchSize
) {}
```

The application gets a compact, discoverable configuration surface:

```yaml
acme:
  delivery:
    enabled: true
    flush-interval: 2s
    batch-size: 100
```

Add the configuration processor to the auto-configuration module so supported IDEs can discover property names, types, defaults, and descriptions in Spring Boot's [configuration metadata format](https://docs.spring.io/spring-boot/specification/configuration-metadata/format.html):

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-configuration-processor</artifactId>
    <optional>true</optional>
</dependency>
```

Keep property names stable, validate values that can make the application unsafe, and document the operational consequence of each setting. A boolean named `enabled` is not enough if a reader cannot tell whether it changes data retention, network calls, or merely log verbosity.

---

## 5. Ship Test Support, Not Just Production Code

Your consumers' tests are clients of the library too. If every service needs to rebuild the same fixtures, mock setup, or architecture rules, the shared module is incomplete.

Put framework-free fixtures, assertions, and test conventions in a separate `delivery-test` module. Consumers can import it only in test scope:

```xml
<dependency>
    <groupId>com.acme.platform</groupId>
    <artifactId>delivery-test</artifactId>
    <scope>test</scope>
</dependency>
```

For auto-configuration itself, prefer a focused context test over starting a complete application:

```java
class DeliveryObservabilityAutoConfigurationTest {

    private final ApplicationContextRunner contextRunner =
            new ApplicationContextRunner()
                    .withConfiguration(AutoConfigurations.of(
                            DeliveryObservabilityAutoConfiguration.class
                    ));

    @Test
    void backsOffWhenTheApplicationProvidesAPublisher() {
        contextRunner
                .withBean(
                        DeliveryObservationPublisher.class,
                        NoOpDeliveryObservationPublisher::new
                )
                .run(context -> assertThat(context)
                        .hasSingleBean(DeliveryObservationPublisher.class)
                        .getBean(DeliveryObservationPublisher.class)
                        .isInstanceOf(NoOpDeliveryObservationPublisher.class));
    }
}
```

This proves the contract that matters: the default is available, and the application remains free to override it. It runs faster and fails more precisely than a broad `@SpringBootTest`.

### Share architectural conventions too

[ArchUnit](https://www.archunit.org/) rules are a particularly good shared test capability. For example, a platform test module can publish a rule that prevents package cycles:

```java
public final class SharedArchitectureRules {

    private SharedArchitectureRules() {
    }

    public static ArchRule packagesAreFreeOfCycles(String basePackage) {
        return slices()
                .matching(basePackage + ".(*)..")
                .should()
                .beFreeOfCycles();
    }
}
```

Each service still decides which rule set applies to it, but it no longer has to rediscover the implementation. If a convention is mandatory, make that visible in the build rather than relying on a wiki page nobody opens during a deadline.

---

## 6. Document at the Same Granularity You Build

A root README is not enough once the library has multiple artifacts. The root should answer "which module do I need?", while each module README answers "what does this artifact do, and how do I use it?"

```text
delivery/
├── README.md
├── delivery-core/
│   └── README.md
├── delivery-spring/
│   └── README.md
├── delivery-spring-boot-autoconfigure/
│   └── README.md
├── delivery-spring-boot-starter/
│   └── README.md
└── delivery-test/
    └── README.md
```

Link the documents in both directions. A reader who starts at the starter must be able to find the configuration reference; a reader who starts in `core` must be able to understand why the starter exists.

Every consumer-facing module benefits from the same minimum documentation:

1. Its responsibility and non-goals
2. The dependency declaration
3. A runnable, minimal example
4. Configuration defaults and supported overrides
5. Compatibility and migration notes

Write for the developer who has never attended your architecture meeting. If setup requires tribal knowledge, the module has not really reduced duplication.

---

## 7. Make Upgrades Boring

Changing a shared library changes many applications at once. Treat that as an API change even when every client belongs to the same company.

Maintain a short [changelog](https://keepachangelog.com/en/1.1.0/) and, for any non-trivial change, a migration note containing:

- What changed and why
- The old usage
- The replacement usage
- Any ordering, configuration, or behavioral differences

Before-and-after examples turn an upgrade from a guessing game into a mechanical edit. They are especially valuable for auto-configuration changes, where a new default can alter an application without a direct Java call site.

Maven's [dependency management](https://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html) lets a BOM keep a related family of artifacts aligned:

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.acme.platform</groupId>
            <artifactId>delivery-bom</artifactId>
            <version>1.4.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

There is no universal versioning strategy. Supporting several major versions may be necessary for a large platform, but it also multiplies testing, documentation, and support work. A smaller organization may be better served by a single supported line and planned consumer upgrades. Choose the simplest policy your team can actually maintain, and use fixed versions so builds remain reproducible.

---

## 8. Resist Clever Framework Magic

The most expensive shared-library feature is often the one that looked clever during the demo:

- Deep hooks into Spring internals can break on an upgrade.
- Aggressive component scanning makes ownership and overrides unclear.
- Global behavior with no opt-out turns a convenience into an incident.

Before adding custom infrastructure, look for the framework's intended extension point: a customizer, condition, callback, or property. Those seams are more likely to survive framework upgrades than copied internal code.

The same rule applies to the module itself: prefer a small explicit API, clear defaults, and easy overrides over a configuration system that can express every possible scenario. Your future consumers will thank you by not opening a support ticket at 2 AM.

---

## A Shared-Module Checklist

Before publishing the next internal starter, verify that it:

1. Keeps framework-free APIs separate from Spring and Spring Boot integration.
2. Uses a starter for deliberate defaults and conditions for optional integrations.
3. Lets applications override default beans without fighting the container.
4. Generates useful configuration metadata and documents the effect of each property.
5. Provides test fixtures or rules where consumers would otherwise repeat them.
6. Documents each artifact, its setup, and its migration path.
7. Has a versioning policy the team can support with reproducible builds.

A good shared Spring Boot module feels boring to install, predictable to configure, and easy to remove or replace. That is not a lack of ambition. It is exactly what reusable infrastructure should be.
