# Two stages so the runtime image carries a JRE and the jar, not Maven and the whole
# dependency cache. Dependencies are resolved before src is copied, so editing code
# does not invalidate the layer that downloads them.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
# firebase-admin pulls in gRPC and the Google auth stack — a few hundred jars, and a
# dropped connection mid-download fails the whole build. Retries turn that into a pause.
RUN mvn -B -Dmaven.wagon.http.retryHandler.count=5 \
        -Dmaven.wagon.httpconnectionManager.ttlSeconds=120 \
        dependency:go-offline
COPY src ./src
RUN mvn -B clean package -DskipTests

# Ubuntu, not Alpine. Nothing here needs glibc the way an in-process embedding model
# would, but firebase-admin ships gRPC with optional native epoll/tcnative paths, and
# a musl image turns any of those into an opaque "container failed to start" on Cloud
# Run. The ~100MB is worth not debugging that from revision logs.
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd --system app && useradd --system --gid app --no-create-home app
COPY --from=build /build/target/*.jar app.jar
USER app

# Cloud Run assigns the port at runtime and passes it as PORT; application.yml reads it
# via server.port=${PORT:8080}. 8080 is only the local default, and matches Cloud Run's
# own default container port.
ENV PORT=8080
EXPOSE 8080

# Containers report the cgroup limit as total memory, so a percentage keeps the heap
# sized to whatever --memory the service is given instead of a figure baked in here.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=70", "-jar", "/app/app.jar"]
