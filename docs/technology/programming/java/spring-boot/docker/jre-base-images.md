---
sidebar_position: 2
---

# JRE Base Images on Alpine Linux

The default `openjdk` images are often built on top of full-sized Linux distributions (like Debian or Ubuntu) and include the full Java Development Kit (JDK).

## The Problem: The JDK is Overkill

A JDK is for developing software. It includes:

- Compilers (`javac`)
- Debuggers
- Profiling tools
- Documentation
- Development headers

Once your app is compiled into a JAR file, you don't need any of that. You only need the **Java Runtime Environment (JRE)** to execute the bytecode.

### Why It Matters

**JDK-based images (typical):**
- `openjdk:17` - ~600MB
- Contains tools attackers could exploit
- Slower pull/push times
- More storage costs

## The Solution: JRE on Alpine Linux

By switching to `eclipse-temurin:17-jre-alpine`, you are making two massive changes:

### 1. JRE Only

You strip out all development tools. The JRE contains only:
- The Java Virtual Machine (JVM)
- Core class libraries
- Runtime configuration

### 2. Alpine Linux

Alpine is a security-oriented, lightweight Linux distribution:

| Distribution | Base Size |
|-------------|-----------|
| Debian/Ubuntu | ~100 MB+ |
| Alpine Linux | ~5 MB |

### Benefits

**Security**
- Fewer binaries in your image means fewer "knobs" for an attacker to turn
- Minimal shell environment reduces exploitation surface
- No extra utilities (curl, wget, ssh) for attackers to leverage

**Speed**
- Pulling a 600 MB image over a network takes significantly longer than pulling a 60 MB image
- Critical in auto-scaling environments where seconds matter
- Faster CI/CD pipeline execution

**Cost**
- Less registry storage
- Reduced bandwidth for image distribution
- Lower memory footprint at runtime

## Available Eclipse Temurin JRE Tags

```dockerfile
# Java 17 JRE on Alpine
eclipse-temurin:17-jre-alpine

# Java 21 JRE on Alpine
eclipse-temurin:21-jre-alpine

# Java 17 JRE on Ubuntu (if you need glibc compatibility)
eclipse-temurin:17-jre
```

## Image Size Comparison

```
REPOSITORY              TAG                      SIZE
openjdk                 17-jdk-slim             400MB
openjdk                 17-jdk                  600MB
eclipse-temurin         17-jdk-alpine           180MB
eclipse-temurin         17-jre-alpine            60MB
```

## Basic Dockerfile Example

```dockerfile
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

## Best Practices

1. **Always use JRE for production** - Never ship a JDK to production unless you're doing runtime compilation
2. **Pin your base image version** - Use specific tags like `17-jre-alpine` instead of `latest`
3. **Consider your dependencies** - If your app needs glibc-specific libraries, you might need the non-Alpine variant

## When to Use Non-Alpine Images

Some applications may need the standard Ubuntu-based images:

- Native libraries requiring glibc
- Complex SSL/TLS configurations
- Specific debugging tools needed in production

In these cases, use `eclipse-temurin:17-jre` (non-Alpine) which is still smaller than a full JDK.

## Next Steps

- Learn about [Multi-Stage Builds](./multi-stage-builds) to separate your build and runtime environments
- Explore [Layered JARs](./layered-jars) for even faster deployments
