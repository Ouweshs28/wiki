---
sidebar_position: 5
---

# Strategy Pattern in Spring Boot

## Overview

The Strategy pattern is a behavioral design pattern that enables selecting an algorithm's behavior at runtime. In Spring Boot, this pattern is particularly useful when you need to apply different business rules based on certain conditions.

## Implementation in Spring Boot

### 1. Define the Strategy Interface

```java
public interface JurisdictionCalculator {
    boolean applies(ProvinceState province);
    BigDecimal calculateAverageDailyHours(EmployeeDailyHour employee, 
                                      LocalDate holiday, 
                                      List<String> earningCodes, 
                                      DayOfWeek workWeekStartDay);
    // Other required methods...
}
```

### 2. Create Concrete Strategies

```java
@Component
public class OntarioCalculator implements JurisdictionCalculator {
    @Override
    public boolean applies(ProvinceState province) {
        return ProvinceState.ONTARIO.equals(province);
    }

    @Override
    public BigDecimal calculateAverageDailyHours(EmployeeDailyHour employee, 
                                              LocalDate holiday, 
                                              List<String> earningCodes, 
                                              DayOfWeek workWeekStartDay) {
        // Ontario-specific calculation logic
        return BigDecimal.ZERO;
    }
}
```

### 3. Using the Strategy in a Service

```java
@Service
public class HolidayPayService {
    private final JurisdictionCalculator calculator;
    
    @Autowired
    public HolidayPayService(JurisdictionCalculator calculator) {
        this.calculator = calculator;
    }
    
    public BigDecimal calculateHolidayPay(EmployeeDailyHour employee, 
                                       LocalDate holiday) {
        return calculator.calculateAverageDailyHours(
            employee, holiday, getEarningCodes(), getWorkWeekStartDay());
    }
}
```

## Benefits in Spring Boot

- **Loose Coupling**: Strategies are decoupled from the client code
- **Testability**: Easy to test each strategy in isolation
- **Extensibility**: New strategies can be added without modifying existing code
- **Spring Integration**: Leverages Spring's dependency injection
