# Build context is the repo root — see src/Bazimoon.Api/Dockerfile for why.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/Bazimoon.Domain/Bazimoon.Domain.csproj src/Bazimoon.Domain/
COPY src/Bazimoon.Infrastructure/Bazimoon.Infrastructure.csproj src/Bazimoon.Infrastructure/
COPY src/Bazimoon.Bot/Bazimoon.Bot.csproj src/Bazimoon.Bot/
RUN dotnet restore src/Bazimoon.Bot/Bazimoon.Bot.csproj

COPY src/Bazimoon.Domain/ src/Bazimoon.Domain/
COPY src/Bazimoon.Infrastructure/ src/Bazimoon.Infrastructure/
COPY src/Bazimoon.Bot/ src/Bazimoon.Bot/
RUN dotnet publish src/Bazimoon.Bot/Bazimoon.Bot.csproj -c Release -o /app/publish --no-restore

# Worker service, no HTTP hosting needed — plain "runtime" image, not "aspnet".
FROM mcr.microsoft.com/dotnet/runtime:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "Bazimoon.Bot.dll"]
