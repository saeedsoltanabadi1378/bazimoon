using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Bazimoon.Infrastructure.History;

/// <summary>Used only by `dotnet ef migrations add/database update` at design time — no live Postgres needed to build the model.</summary>
public sealed class BazimoonDbContextFactory : IDesignTimeDbContextFactory<BazimoonDbContext>
{
    public BazimoonDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<BazimoonDbContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Database=bazimoon;Username=bazimoon;Password=bazimoon");
        return new BazimoonDbContext(optionsBuilder.Options);
    }
}
