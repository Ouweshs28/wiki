---
sidebar_position: 3
---

# Multi-Stage Builds

In the "old days," you'd run `mvn package` on your laptop or a Jenkins server and then `docker build` to copy the resulting JAR. This is messy and inconsistent.

## The Problem: "It Works on My Machine"

When building outside of Docker, several issues can occur:

- **Version Mismatches**: Local machine uses Java 17.0.1 but production uses 17.0.9
- **Environment Differences**: Different OS libraries, locale settings, timezone
- **Local "Junk"**: Your `target` folder might contain stale files from previous builds
- **Dependency Conflicts**: Maven local repository inconsistencies

## The Solution: The "Build" and "Run" Split

Multi-stage builds allow you to use a heavy image (with Maven and the JDK) to compile your code, then discard that entire environment and move only the final JAR to a slim "Runtime" image.

### How It Works

```dockerfile
# Stage 1: The "Heavyweight" Builder
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: The "Lightweight" Runner
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
# We only grab the JAR from the previous stage
COPY --from=build /app/target/*.jar app.jar
ENTRYPOINT ["java","-jar","/app/app.jar"]
```

### Key Components

**Stage 1: Build**
- Uses a full Maven + JDK image
- Compiles your source code
- Runs tests (optional)
- Produces the JAR artifact

**Stage 2: Runtime**
- Starts fresh with only the JRE
- Copies just the compiled JAR from Stage 1
- No source code, test files, or Maven cache included

## Why This Matters

### Consistency

The code is compiled in the exact same environment every time:

```dockerfile
# Same Maven version
# Same Java version
# Same OS libraries
# Regardless of who triggers the build
```

### Zero Leftovers

Your final image contains only what it needs:

| What's NOT in the final image | Size Saved |
|------------------------------|------------|
| Source code (`src/`) | ~MBs |
| Test classes | ~KBs |
| Maven local repository (`~/.m2`) | ~GBs |
| Build tools (Maven, JDK) | ~200MB |
| Git history | ~MBs |

## Advanced: Caching Dependencies

To speed up rebuilds, cache Maven dependencies separately from source code:

```dockerfile
# Stage 1: Build with dependency caching
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app

# Copy pom.xml first (changes less frequently)
COPY pom.xml .

# Download dependencies (cached layer)
RUN mvn dependency:go-offline

# Copy source (changes frequently)
COPY src ./src

# Build (fast when deps are cached)
RUN mvn clean package -DskipTests

# Stage 2: Runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENTRYPOINT ["java","-jar","/app/app.jar"]
```

### How the Caching Works

1. `COPY pom.xml .` - Docker caches this layer
2. `RUN mvn dependency:go-offline` - Only re-runs if `pom.xml` changes
3. `COPY src ./src` - This layer changes frequently
4. `RUN mvn clean package` - Fast because dependencies are already downloaded

## Using Gradle Instead of Maven

```dockerfile
# Stage 1: Build
FROM gradle:8.5-jdk17-alpine AS build
WORKDIR /app
COPY build.gradle.kts settings.gradle.kts ./
COPY gradle ./gradle
RUN gradle dependencies --no-daemon
COPY src ./src
RUN gradle bootJar --no-daemon

# Stage 2: Runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
ENTRYPOINT ["java","-jar","/app/app.jar"]
```

## Best Practices

1. **Order your COPY commands** - Put files that change less frequently first
2. **Use specific base image tags** - Avoid `latest` tag for reproducible builds
3. **Leverage Docker layer caching** - Structure Dockerfile to maximize cache hits
4. **Keep build stages separate** - Don't combine build and runtime concerns

## Common Issues and Solutions

### Issue: Slow Builds Due to Re-downloading Dependencies

**Solution**: Use `dependency:go-offline` or `gradle dependencies` before copying source.

### Issue: JAR File Name Changes

**Solution**: Use a wildcard pattern:
```dockerfile
COPY --from=build /app/target/*.jar app.jar
```

Or use `ARG` for the JAR name:
```dockerfile
ARG JAR_FILE=target/myapp-*.jar
COPY --from=build /app/${JAR_FILE} app.jar
```

## Next Steps

- Combine multi-stage builds with [JRE Base Images](./jre-base-images) for minimal runtime
- Learn about [Layered JARs](./layered-jars) to optimize Docker layer caching
