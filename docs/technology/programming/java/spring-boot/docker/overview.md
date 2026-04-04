---
sidebar_position: 1
---

# Docker Image Optimization for Spring Boot

Docker images for Spring Boot applications often start bloated—large downloads, slow CI/CD pipelines, and unnecessary attack surface. This guide shows you how to dramatically reduce image size while improving security and build speed.

## Overview

This guide covers three key optimization techniques:

1. **[JRE Base Images](./jre-base-images)** - Using lightweight Alpine-based JRE images instead of full JDK distributions
2. **[Multi-Stage Builds](./multi-stage-builds)** - Separating build and runtime environments for clean, consistent images
3. **[Layered JARs](./layered-jars)** - Breaking the Fat JAR into layers for blazing fast rebuilds and caching

## Why Optimize?

| Problem | Impact |
|---------|--------|
| Large image size | Slow deployments, expensive registry storage |
| Full JDK in production | Unnecessary attack surface, security risk |
| Fat JAR changes | Entire image re-uploaded on every code change |
| Inconsistent build environments | "It works on my machine" issues |

## Summary of Improvements

| Technique | Image Size Impact | Build Speed Impact | Benefit |
|-----------|-------------------|-------------------|---------|
| JRE Base Image | High reduction | Minimal | Smaller footprint, better security |
| Multi-Stage Build | Medium reduction | Slower first build | Clean images, environment parity |
| Layered JARs | Minimal size change | Huge increase | Lightning-fast deployments and caching |

## Quick Start

Here's the complete optimized Dockerfile combining all three techniques:

```dockerfile
# Stage 1: Extract layers from the JAR
FROM eclipse-temurin:17-jre-alpine as builder
WORKDIR /app
ARG JAR_FILE=target/*.jar
COPY ${JAR_FILE} application.jar
RUN java -Djarmode=layertools -jar application.jar extract

# Stage 2: Create the runtime image
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/dependencies/ ./
COPY --from=builder /app/spring-boot-loader/ ./
COPY --from=builder /app/snapshot-dependencies/ ./
COPY --from=builder /app/application/ ./
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

## Prerequisites

- Spring Boot 2.3+ (for layered JAR support)
- Docker 17.05+ (for multi-stage builds)
- Maven or Gradle for building

## Next Steps

Dive into each section to understand the concepts in detail:

- [JRE Base Images](./jre-base-images) - Understand why the JDK is overkill for production
- [Multi-Stage Builds](./multi-stage-builds) - Learn the build/run split pattern
- [Layered JARs](./layered-jars) - Master Docker layer caching for faster deployments

## Alternative: GraalVM Native Images

For even smaller images and near-instant startup, consider [GraalVM Native Images](https://docs.spring.io/spring-boot/docs/current/reference/html/native-image.html). This compiles your Spring Boot application ahead-of-time into a native executable, eliminating the JVM entirely. Trade-offs include significantly longer build times and some limitations with dynamic Java features.
