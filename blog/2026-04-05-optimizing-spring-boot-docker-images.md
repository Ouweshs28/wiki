---
slug: optimizing-spring-boot-docker-images
title: "Optimizing Spring Boot Docker Images"
authors: [ouwesh]
tags: [spring-boot, docker, java, devops, optimization]
date: 2026-04-05
---

Docker images for Spring Boot applications often start bloated—large downloads, slow CI/CD pipelines, and unnecessary attack surface. This post shows you how to dramatically reduce image size while improving security and build speed.

In this post we'll look at:

- **Using JRE base images on Alpine Linux**
- **Multi-stage builds for clean, consistent images**
- **Layered JARs for blazing fast rebuilds**
- **Summary of improvements and trade-offs**

{/* truncate */}

## 1. Choosing the Right Base Image

The default `openjdk` images are often built on top of full-sized Linux distributions (like Debian or Ubuntu) and include the full Java Development Kit (JDK).

### The Problem: The JDK is Overkill

A JDK is for developing software. It includes compilers (`javac`), debuggers, and profiling tools. Once your app is compiled into a JAR file, you don't need any of that. You only need the Java Runtime Environment (JRE).

### The Solution: JRE on Alpine Linux

By switching to `eclipse-temurin:17-jre-alpine`, you are making two massive changes:

- **JRE Only**: You strip out the development tools.
- **Alpine Linux**: Alpine is a security-oriented, lightweight Linux distribution that is roughly 5 MB in size, compared to ~100 MB+ for standard distributions.

**Why this matters:**

- **Security**: Fewer binaries in your image means fewer "knobs" for an attacker to turn. There's no shell-scripting environment or extra utilities for them to exploit.
- **Speed**: Pulling a 600 MB image over a network takes significantly longer than pulling a 150 MB image, especially in auto-scaling environments.

---

## 2. Multi-Stage Builds

In the "old days," you'd run `mvn package` on your laptop or a Jenkins server and then `docker build` to copy the resulting JAR. This is messy and inconsistent.

### The Problem: "It Works on My Machine"

If your local machine uses Java 17.0.1 but your production Docker image uses 17.0.9, you might encounter subtle runtime bugs. Plus, your image ends up containing whatever local "junk" was in your `target` folder.

### The Solution: The "Build" and "Run" Split

Multi-stage builds allow you to use a heavy image (with Maven and the JDK) to compile your code, then discard that entire environment and move only the final JAR to a slim "Runtime" image.

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

**Why this matters:**

- **Consistency**: The code is compiled in the exact same environment every time, regardless of who triggers the build.
- **Zero Leftovers**: Your final image won't contain your source code, your unit tests, or your Maven local repository—just the executable.

---

## 3. Layered JARs and Caching

This is where the magic happens for developer productivity. Docker works on a Layered File System. If a layer hasn't changed, Docker reuses the cached version.

### The Problem: The "Fat JAR" Bottleneck

Spring Boot typically creates a "Fat JAR" where your 1 MB of code is packaged inside a 60 MB file filled with 59 MB of libraries (Spring, Hibernate, etc.). If you change one line of code, the entire 60 MB JAR is considered "changed" by Docker. You have to upload that whole 60 MB layer every time you deploy.

### The Solution: Breaking the JAR into Layers

By enabling layers in your `pom.xml`, Spring Boot organizes the JAR content by how often it changes:

- **Dependencies**: (Changes rarely)
- **Spring Boot Loader**: (Changes almost never)
- **Snapshot Dependencies**: (Changes occasionally)
- **Application Code**: (Changes every build)

**Enable layers in pom.xml:**

```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
            <configuration>
                <layers>
                    <enabled>true</enabled>
                </layers>
            </configuration>
        </plugin>
    </plugins>
</build>
```

### The Optimized Dockerfile

```dockerfile
FROM eclipse-temurin:17-jre-alpine as builder
WORKDIR /app
ARG JAR_FILE=target/*.jar
COPY ${JAR_FILE} application.jar
# This command extracts the layers
RUN java -Djarmode=layertools -jar application.jar extract

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
# We copy each layer individually.
# Docker will cache the 'dependencies' layer and only update 'application'
COPY --from=builder /app/dependencies/ ./
COPY --from=builder /app/spring-boot-loader/ ./
COPY --from=builder /app/snapshot-dependencies/ ./
COPY --from=builder /app/application/ ./
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

**Why this matters:**

- **Instant Re-builds**: When you fix a typo in a Controller, Docker sees that the dependencies layer is the same. It skips downloading/extracting 95% of the data and only updates the tiny application layer.
- **Bandwidth Efficiency**: Your CI/CD pipeline only pushes a few kilobytes of changes to the container registry instead of a massive JAR file every time.

---

## 4. Summary of Improvements

| Technique | Image Size Impact | Build Speed Impact | Benefit |
|-----------|-------------------|-------------------|---------|
| JRE Base Image | High reduction (~600MB → ~60MB) | Minimal | Smaller footprint, better security |
| Multi-Stage Build | Medium reduction | Slower first build | Clean images, environment parity |
| Layered JARs | Minimal size change | Huge increase | Lightning-fast deployments and caching |

### Key Takeaways

1. **Start with the right base image**: `eclipse-temurin:17-jre-alpine` gives you a minimal, secure foundation.
2. **Use multi-stage builds**: Compile in a heavyweight container, ship only the runtime.
3. **Enable layered JARs**: Let Docker cache your dependencies separately from your application code.

These three techniques combined will transform your Spring Boot deployments from sluggish, bloated containers to lean, fast, secure microservices.

---

## Alternative: GraalVM Native Images

For even smaller images and near-instant startup, consider [GraalVM Native Images](https://docs.spring.io/spring-boot/docs/current/reference/html/native-image.html). This compiles your Spring Boot application ahead-of-time into a native executable, eliminating the JVM entirely. Trade-offs include significantly longer build times and some limitations with dynamic Java features.
