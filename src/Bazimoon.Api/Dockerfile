# Build context is the repo root (not this folder) — Bazimoon.Api references sibling projects
# (Domain, Infrastructure), so the whole src/ tree needs to be in the build context.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files first and restore, so this layer is cached unless a .csproj actually changes.
COPY src/Bazimoon.Domain/Bazimoon.Domain.csproj src/Bazimoon.Domain/
COPY src/Bazimoon.Infrastructure/Bazimoon.Infrastructure.csproj src/Bazimoon.Infrastructure/
COPY src/Bazimoon.Api/Bazimoon.Api.csproj src/Bazimoon.Api/
RUN dotnet restore src/Bazimoon.Api/Bazimoon.Api.csproj

COPY src/Bazimoon.Domain/ src/Bazimoon.Domain/
COPY src/Bazimoon.Infrastructure/ src/Bazimoon.Infrastructure/
COPY src/Bazimoon.Api/ src/Bazimoon.Api/
RUN dotnet publish src/Bazimoon.Api/Bazimoon.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "Bazimoon.Api.dll"]
