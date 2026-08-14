---
slug: strategy-factory-pattern-calculator
title: "Building a Flexible Calculator Engine with Strategy and Factory Patterns in Spring Boot"
authors: [ouwesh]
tags: [java, design-patterns, spring, strategy-pattern, factory-pattern]
---

In this article, we'll explore how to build a flexible and maintainable calculator engine using the Strategy and Factory design patterns in a Spring Boot application. This pattern is particularly useful when you need to apply different calculation rules based on different jurisdictions or conditions.

{/* truncate */}

## Overview

We'll implement a system that calculates statutory holiday pay for employees based on their jurisdiction. Each jurisdiction (like Ontario, Quebec, etc.) has its own rules for calculating holiday pay, making this a perfect use case for the Strategy pattern.

## The Architecture

### 1. The Strategy Interface

First, let's define our strategy interface that all concrete strategies will implement:

```java
public interface JurisdictionCalculator {
    boolean applies(ProvinceState province);
    ProvinceState getJurisdictionCode();
    BigDecimal calculateAverageDailyHours(EmployeeDailyHour employee, LocalDate holiday, 
                                       List<String> earningCodes, DayOfWeek workWeekStartDay);
    int getDurationOfCalculation();
    List<String> getRequiredEarningCodes(Long companyId);
    LocalDateRange getRequiredDateRange(LocalDate holiday, DayOfWeek workWeekStartDay);
}
```

### 2. Concrete Strategy Implementations

For each jurisdiction, we'll create a concrete implementation. Here's a template for the Ontario calculator (kept blank as requested):

```java
@Component
public class OntarioCalculator implements JurisdictionCalculator {
    @Override
    public boolean applies(ProvinceState province) {
        return ProvinceState.ONTARIO.equals(province);
    }

    @Override
    public ProvinceState getJurisdictionCode() {
        return ProvinceState.ONTARIO;
    }

    @Override
    public BigDecimal calculateAverageDailyHours(EmployeeDailyHour employee, LocalDate holiday, 
                                              List<String> earningCodes, DayOfWeek workWeekStartDay) {
        // Implementation specific to Ontario
        return BigDecimal.ZERO;
    }

    @Override
    public int getDurationOfCalculation() {
        return 0;
    }

    @Override
    public List<String> getRequiredEarningCodes(Long companyId) {
        return Collections.emptyList();
    }

    @Override
    public LocalDateRange getRequiredDateRange(LocalDate holiday, DayOfWeek workWeekStartDay) {
        return null;
    }
}
```

### 3. The Factory Class

The factory is responsible for providing the appropriate calculator based on the province:

```java
@Component
public class JurisdictionCalculatorFactory {
    private final List<JurisdictionCalculator> calculators;

    public JurisdictionCalculatorFactory(List<JurisdictionCalculator> calculators) {
        this.calculators = calculators;
    }

    public JurisdictionCalculator getCalculator(ProvinceState province) {
        return calculators.stream()
                .filter(calculator -> calculator.applies(province))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No calculator found for province: " + province));
    }
}
```

### 4. The Service Layer

The service uses the factory to get the appropriate calculator and perform calculations:

```java
@Service
@Slf4j
public class StatutoryHolidayPayService {
    private final JurisdictionCalculatorFactory calculatorFactory;

    public StatutoryHolidayPayService(JurisdictionCalculatorFactory calculatorFactory) {
        this.calculatorFactory = calculatorFactory;
    }

    public StatutoryHolidayResult calculateHolidayResult(StatutoryHolidayRequest request, Long companyId) {
        // Implementation that uses the factory to get the right calculator
        // and performs the calculation
        return null;
    }
}
```

## Benefits of This Approach

1. **Open/Closed Principle**: Easy to add new jurisdictions without modifying existing code
2. **Single Responsibility**: Each class has a single responsibility
3. **Testability**: Each calculator can be tested in isolation
4. **Maintainability**: Changes to one jurisdiction don't affect others

## Implementation Example

Here's how you would use this in a controller:

```java
@RestController
@RequestMapping("/api/holiday-pay")
public class HolidayPayController {
    private final StatutoryHolidayPayService holidayPayService;

    public HolidayPayController(StatutoryHolidayPayService holidayPayService) {
        this.holidayPayService = holidayPayService;
    }

    @PostMapping("/calculate")
    public ResponseEntity<StatutoryHolidayResult> calculateHolidayPay(
            @RequestBody StatutoryHolidayRequest request,
            @RequestParam Long companyId) {
        return ResponseEntity.ok(holidayPayService.calculateHolidayResult(request, companyId));
    }
}
```

## Adding a New Jurisdiction

To add a new jurisdiction, simply create a new class that implements `JurisdictionCalculator` and add the `@Component` annotation. The factory will automatically pick it up thanks to Spring's dependency injection.

```java
@Component
public class QuebecCalculator implements JurisdictionCalculator {
    // Implementation for Quebec
}
```

## Conclusion

By using the Strategy and Factory patterns together, we've created a flexible and maintainable solution for handling different calculation rules across jurisdictions. This approach makes it easy to add new rules or modify existing ones without affecting other parts of the system.

Remember to:
1. Keep each calculator focused on a single jurisdiction
2. Use the factory to abstract away the creation of calculators
3. Leverage Spring's dependency injection to manage calculator instances
4. Write unit tests for each calculator independently
