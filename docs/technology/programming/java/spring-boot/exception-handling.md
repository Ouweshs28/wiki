---
sidebar_position: 2
---

# Exception Handling in Spring Boot

## Overview

Exception handling is a crucial aspect of building robust Spring Boot applications. The `ProjectTemplateResponseEntityExceptionHandler` class demonstrates a comprehensive approach to handling exceptions in a RESTful API. Let's break down this implementation and understand its components.

## The Base Exception Handler

The `ResponseEntityExceptionHandler` is a convenient base class that provides centralized exception handling across all `@RequestMapping` methods through `@ExceptionHandler` methods.

## Key Components

### 1. Class Definition

```java
@Slf4j
@ControllerAdvice("com.project.template.rest")
public class ProjectTemplateResponseEntityExceptionHandler 
    extends ResponseEntityExceptionHandler {
    // Implementation
}
```

- `@Slf4j`: Lombok annotation for logging
- `@ControllerAdvice`: Defines global exception handling for controllers in the specified package
- Extends `ResponseEntityExceptionHandler` for default Spring MVC exception handling

### 2. Dependencies

```java
private final ErrorAttributes errorAttributes;

public ProjectTemplateResponseEntityExceptionHandler(ErrorAttributes errorAttributes) {
    super();
    this.errorAttributes = errorAttributes;
}
```

- `ErrorAttributes`: Provides access to error attributes which can be logged or returned to the client

## Exception Handling Methods

### 1. Constraint Violation Exception

```java
@ExceptionHandler
public ResponseEntity<Object> handleConstraintViolationException(
    ConstraintViolationException e, WebRequest request) {
    return handleExceptionInternal(e, new HttpHeaders(), HttpStatus.BAD_REQUEST, request);
}
```

- Handles validation exceptions (e.g., `@Valid` failures)
- Returns HTTP 400 Bad Request

### 2. Resource Not Found Exception

```java
@ExceptionHandler
public ResponseEntity<Object> handleResourceNotFoundException(
    ResourceNotFoundException e, WebRequest request) {
    return handleExceptionInternal(e, new HttpHeaders(), HttpStatus.NOT_FOUND, request);
}
```

- Handles cases when a requested resource is not found
- Returns HTTP 404 Not Found

## Core Exception Handling Logic

### 1. Main Exception Handler

```java
@Override
@NonNull
protected ResponseEntity<Object> handleExceptionInternal(
    @NonNull Exception ex, 
    @Nullable Object additionalBody, 
    @NonNull HttpHeaders headers, 
    HttpStatusCode status, 
    @NonNull WebRequest request) {
    
    // Get error attributes with binding errors and message
    Map<String, Object> body = errorAttributes.getErrorAttributes(
        request, 
        of(BINDING_ERRORS, MESSAGE)
    );

    // Extract status details
    HttpStatus httpStatus = HttpStatus.valueOf(status.value());
    String reasonPhrase = httpStatus.getReasonPhrase();

    // Enhance error response
    body.put("error", reasonPhrase);
    body.put("path", request.getDescription(false));
    body.put("status", status.value());

    // Include additional error details if provided
    if (additionalBody instanceof Map<?, ?> additionalBodyAsMap) {
        additionalBodyAsMap.forEach((key, value) -> body.put(String.valueOf(key), value));
    }
    
    return Objects.requireNonNull(
        super.handleExceptionInternal(ex, body, headers, httpStatus, request)
    );
}
```

### 2. Convenience Method

```java
private ResponseEntity<Object> handleExceptionInternal(
    Exception ex, 
    HttpHeaders headers, 
    HttpStatusCode status, 
    WebRequest request) {
    
    return this.handleExceptionInternal(ex, null, headers, status, request);
}
```

## Error Response Structure

The error response includes:
- `error`: HTTP status reason phrase
- `path`: Request path that caused the error
- `status`: HTTP status code
- Additional validation errors (if any)

Example error response (HTTP 400):

```json
{
  "error": "Bad Request",
  "path": "/api/resource/123",
  "status": 400,
  "message": "Validation failed for argument..."
}
```

## Best Practices

1. **Global Exception Handling**
   - Use `@ControllerAdvice` for consistent error handling
   - Extend `ResponseEntityExceptionHandler` for default Spring MVC exceptions

2. **Custom Exceptions**
   - Create specific exceptions for different error scenarios
   - Use `@ExceptionHandler` methods for each exception type

3. **Error Response**
   - Include meaningful error messages
   - Provide consistent response structure
   - Include relevant error details

4. **Logging**
   - Log all exceptions with appropriate levels (ERROR for server errors, WARN for client errors)
   - Include relevant context in logs

5. **Security**
   - Don't expose stack traces in production
   - Sanitize error messages to avoid information leakage

## Extending the Handler

To add support for additional exceptions:

```java
@ExceptionHandler
public ResponseEntity<Object> handleCustomException(
    CustomException e, 
    WebRequest request) {
    
    Map<String, String> additionalBody = Map.of(
        "errorCode", e.getErrorCode(),
        "details", e.getDetails()
    );
    
    return handleExceptionInternal(
        e, 
        additionalBody, 
        new HttpHeaders(), 
        HttpStatus.BAD_REQUEST, 
        request
    );
}
```
