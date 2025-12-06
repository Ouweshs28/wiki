---
sidebar_position: 6
---

# Factory Pattern in Spring Boot

## Overview

The Factory pattern is a creational pattern that provides an interface for creating objects in a superclass but allows subclasses to alter the type of objects that will be created. In Spring Boot, this pattern is often implemented using `@Component` and dependency injection.

## Implementation in Spring Boot

### 1. The Factory Class

```java
@Component
public class JurisdictionCalculatorFactory {
    private final List<JurisdictionCalculator> calculators;

    @Autowired
    public JurisdictionCalculatorFactory(List<JurisdictionCalculator> calculators) {
        this.calculators = calculators;
    }

    public JurisdictionCalculator getCalculator(ProvinceState province) {
        return calculators.stream()
                .filter(calculator -> calculator.applies(province))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                    "No calculator found for province: " + province));
    }
}
```

### 2. Using the Factory in a Service

```java
@Service
public class StatutoryHolidayPayService {
    private final JurisdictionCalculatorFactory calculatorFactory;

    @Autowired
    public StatutoryHolidayPayService(JurisdictionCalculatorFactory calculatorFactory) {
        this.calculatorFactory = calculatorFactory;
    }

    public BigDecimal calculateHolidayPay(EmployeeDailyHour employee) {
        JurisdictionCalculator calculator = calculatorFactory
            .getCalculator(employee.getJurisdiction());
            
        return calculator.calculateAverageDailyHours(
            employee, 
            getHolidayDate(), 
            getEarningCodes(), 
            getWorkWeekStartDay()
        );
    }
}
```

## Benefits in Spring Boot

- **Centralized Object Creation**: All object creation logic is in one place
- **Decoupling**: Client code doesn't need to know about concrete implementations
- **Spring Integration**: Leverages Spring's dependency injection for automatic discovery of strategies
- **Easy Testing**: Can mock the factory in tests

## Best Practices

1. **Use Constructor Injection**: For better testability and immutability
2. **Fail Fast**: Throw meaningful exceptions when no suitable strategy is found
3. **Consider Using a Map**: For faster lookups with many strategies
4. **Document Strategies**: Clearly document when and how each strategy should be used
