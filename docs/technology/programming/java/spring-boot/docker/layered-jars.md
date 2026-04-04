---
sidebar_position: 4
---

# Layered JARs and Caching

This is where the magic happens for developer productivity. Docker works on a Layered File System. If a layer hasn't changed, Docker reuses the cached version.

## The Problem: The "Fat JAR" Bottleneck

Spring Boot typically creates a "Fat JAR" where your 1 MB of code is packaged inside a 60 MB file filled with 59 MB of libraries (Spring, Hibernate, etc.).

### The Issue

When you change **one line of code**:

1. The entire 60 MB JAR is considered "changed"
2. Docker has to re-upload the whole 60 MB layer
3. CI/CD pipeline pushes 60 MB to the registry every time
4. Kubernetes pulls 60 MB on every pod restart

**The breakdown:**
```
Fat JAR (60 MB total)
├── Dependencies (59 MB) - rarely changes
├── Spring Boot Loader (0.5 MB) - almost never changes  
├── Snapshot Dependencies (0.3 MB) - changes occasionally
└── Application Code (0.2 MB) - changes every build
```

## The Solution: Breaking the JAR into Layers

Spring Boot's layered JAR feature organizes the JAR content by how often it changes:

| Layer | Typical Size | Change Frequency |
|-------|-------------|------------------|
| Dependencies | ~55 MB | Rarely (new releases) |
| Spring Boot Loader | ~0.5 MB | Almost never |
| Snapshot Dependencies | ~3 MB | Occasionally |
| Application | ~1 MB | Every build |

### Enable Layers in pom.xml

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

### Enable Layers in build.gradle.kts

```kotlin
plugins {
    id("org.springframework.boot") version "3.2.0"
}

tasks.bootJar {
    layered {
        enabled = true
    }
}
```

## The Optimized Dockerfile

```dockerfile
# Stage 1: Extract layers from the JAR
FROM eclipse-temurin:17-jre-alpine as builder
WORKDIR /app
ARG JAR_FILE=target/*.jar
COPY ${JAR_FILE} application.jar
# This command extracts the layers
RUN java -Djarmode=layertools -jar application.jar extract

# Stage 2: Create the runtime image
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copy each layer individually
# Docker caches these layers separately
COPY --from=builder /app/dependencies/ ./
COPY --from=builder /app/spring-boot-loader/ ./
COPY --from=builder /app/snapshot-dependencies/ ./
COPY --from=builder /app/application/ ./

ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

### Layer Extraction Output

After running `java -Djarmode=layertools -jar application.jar extract`:

```
/app/
├── dependencies/          # All released dependencies
│   ├── BOOT-INF/
│   │   └── lib/
│   │       ├── spring-core-6.0.x.jar
│   │       ├── spring-boot-3.x.jar
│   │       └── ...
├── spring-boot-loader/    # Spring Boot's loader classes
│   └── org/
├── snapshot-dependencies/ # Snapshot versions
│   └── BOOT-INF/
│       └── lib/
│           └── my-lib-1.0-SNAPSHOT.jar
└── application/           # Your compiled classes
    ├── BOOT-INF/
    │   ├── classes/       # Your .class files
    │   └── classpath.idx
    └── META-INF/
```

## Why This Matters

### Instant Re-builds

When you fix a typo in a Controller:

1. Docker sees that `dependencies/` layer is the same → **uses cache**
2. Docker sees that `spring-boot-loader/` is the same → **uses cache**
3. Docker sees that `snapshot-dependencies/` is the same → **uses cache**
4. Docker sees that `application/` changed → **only rebuilds this layer**

**Result**: Instead of 60 MB, you push ~1 MB.

### Bandwidth Efficiency

Your CI/CD pipeline benefits:

| Scenario | Fat JAR | Layered JAR |
|----------|---------|-------------|
| Dependency update | 60 MB push | 55 MB push |
| Code change only | 60 MB push | 1 MB push |
| New snapshot | 60 MB push | 4 MB push |

## Understanding the Launcher

Note the entrypoint change:

```dockerfile
# Old way (Fat JAR)
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

# New way (Layered)
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

The `JarLauncher`:
1. Reads the `classpath.idx` file to find all JARs
2. Constructs the classpath from the layers
3. Launches your application

**Note**: In Spring Boot 3.x, the launcher class moved to `org.springframework.boot.loader.launch.JarLauncher`. For Spring Boot 2.x, use `org.springframework.boot.loader.JarLauncher`.

## Layer Configuration (Advanced)

You can customize layer definitions in your build configuration:

### Custom Layers in pom.xml

```xml
<configuration>
    <layers>
        <enabled>true</enabled>
        <configuration>${project.basedir}/src/layers.xml</configuration>
    </layers>
</configuration>
```

### layers.xml Example

```xml
<layers xmlns="http://www.springframework.org/schema/boot/layers"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.springframework.org/schema/boot/layers
                            https://www.springframework.org/schema/boot/layers/layers-3.2.xsd">
    <application>
        <into layer="spring-boot-loader">
            <include>org/springframework/boot/loader/**</include>
        </into>
        <into layer="application"/>
    </application>
    <dependencies>
        <into layer="snapshot-dependencies">
            <include>*:*:*SNAPSHOT</include>
        </into>
        <into layer="company-dependencies">
            <include>com.mycompany:*</include>
        </into>
        <into layer="dependencies"/>
    </dependencies>
</layers>
```

## Best Practices

1. **Always use layered JARs in Docker** - The benefits are significant with minimal effort
2. **Order COPY commands by change frequency** - Dependencies first, application last
3. **Pin Spring Boot versions** - Ensure consistent launcher class behavior
4. **Test your image** - Verify the launcher works correctly with your setup

## Debugging Layer Issues

### Inspect Extracted Layers

```bash
# Build the builder stage
docker build --target builder -t myapp:builder .

# Run and inspect
docker run --rm -it myapp:builder sh
ls -la /app/
```

### Verify Layer Caching

```bash
# Build with layer cache analysis
docker build --progress=plain -t myapp:latest .

# Check image history
docker history myapp:latest
```

## Troubleshooting

### Issue: Launcher Class Not Found

**Error**: `Error: Could not find or load main class org.springframework.boot.loader.JarLauncher`

**Solution**: Ensure you copied the `spring-boot-loader` layer and check your Spring Boot version:
- Spring Boot 3.x: `org.springframework.boot.loader.launch.JarLauncher`
- Spring Boot 2.x: `org.springframework.boot.loader.JarLauncher`

### Issue: Application Won't Start

**Check**: 
1. All four layers are copied in the right order
2. The `dependencies` layer includes all required JARs
3. No files are missing from the extraction

## Summary

| Technique | Benefit |
|-----------|---------|
| Layered JARs | Separate dependencies from application code |
| Layer caching | 95% of image stays cached on code changes |
| Faster deploys | Push only what changed |

Combine layered JARs with [JRE Base Images](./jre-base-images) and [Multi-Stage Builds](./multi-stage-builds) for the ultimate optimized Docker image.
