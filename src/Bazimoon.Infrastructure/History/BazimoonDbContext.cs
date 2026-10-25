using Microsoft.EntityFrameworkCore;
using Bazimoon.Infrastructure.Activity;
using Bazimoon.Infrastructure.Admin;
using Bazimoon.Infrastructure.Hub;
using Bazimoon.Infrastructure.Identity;

namespace Bazimoon.Infrastructure.History;

public sealed class BazimoonDbContext : DbContext
{
    public BazimoonDbContext(DbContextOptions<BazimoonDbContext> options) : base(options)
    {
    }

    public DbSet<GameRecord> Games => Set<GameRecord>();
    public DbSet<GamePlayerRecord> GamePlayers => Set<GamePlayerRecord>();
    public DbSet<AppSettingsRecord> AppSettings => Set<AppSettingsRecord>();
    public DbSet<UserRecord> Users => Set<UserRecord>();
    public DbSet<UserAcquisitionRecord> UserAcquisitions => Set<UserAcquisitionRecord>();
    public DbSet<UserIdentityRecord> UserIdentities => Set<UserIdentityRecord>();
    public DbSet<RefreshTokenRecord> RefreshTokens => Set<RefreshTokenRecord>();
    public DbSet<PushSubscriptionRecord> PushSubscriptions => Set<PushSubscriptionRecord>();
    public DbSet<OperationalEventRecord> OperationalEvents => Set<OperationalEventRecord>();
    public DbSet<PlayerStatsRecord> PlayerStats => Set<PlayerStatsRecord>();
    public DbSet<PuzzleResultRecord> PuzzleResults => Set<PuzzleResultRecord>();
    public DbSet<CoupleRecord> Couples => Set<CoupleRecord>();
    public DbSet<CoupleAnswerRecord> CoupleAnswers => Set<CoupleAnswerRecord>();
    public DbSet<MafiaTableRecord> MafiaTables => Set<MafiaTableRecord>();
    public DbSet<UserActivityEventRecord> UserActivityEvents => Set<UserActivityEventRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserRecord>(b =>
        {
            b.ToTable("users");
            b.HasKey(u => u.Id);
            b.Property(u => u.DisplayName).HasMaxLength(64);
            b.Property(u => u.Language).HasMaxLength(8);
            b.Property(u => u.BotReason).HasMaxLength(16);
            b.Property(u => u.BotMarkedBy).HasMaxLength(256);
            b.HasIndex(u => new { u.IsGuest, u.LastSeenAt });
        });

        modelBuilder.Entity<UserIdentityRecord>(b =>
        {
            b.ToTable("user_identities");
            b.HasKey(i => i.Id);
            b.Property(i => i.Provider).HasMaxLength(16);
            b.Property(i => i.ProviderUserId).HasMaxLength(128);
            b.Property(i => i.Email).HasMaxLength(320);
            b.HasIndex(i => new { i.Provider, i.ProviderUserId }).IsUnique();
            b.HasIndex(i => i.UserId);
            b.HasOne<UserRecord>().WithMany().HasForeignKey(i => i.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserAcquisitionRecord>(b =>
        {
            b.ToTable("user_acquisitions");
            b.HasKey(a => a.UserId);
            b.Property(a => a.Source).HasMaxLength(100);
            b.Property(a => a.Medium).HasMaxLength(100);
            b.Property(a => a.Campaign).HasMaxLength(200);
            b.Property(a => a.Term).HasMaxLength(200);
            b.Property(a => a.Content).HasMaxLength(200);
            b.Property(a => a.Referrer).HasMaxLength(2048);
            b.Property(a => a.LandingPath).HasMaxLength(2048);
            b.Property(a => a.Gclid).HasMaxLength(256);
            b.HasIndex(a => new { a.Source, a.Medium });
            b.HasIndex(a => a.FirstSeenAt);
            b.HasOne<UserRecord>().WithOne().HasForeignKey<UserAcquisitionRecord>(a => a.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PushSubscriptionRecord>(b =>
        {
            b.ToTable("push_subscriptions");
            b.HasKey(s => s.Id);
            b.Property(s => s.Endpoint).HasMaxLength(1024);
            b.Property(s => s.P256dh).HasMaxLength(128);
            b.Property(s => s.Auth).HasMaxLength(64);
            b.HasIndex(s => s.Endpoint).IsUnique();
            b.HasIndex(s => s.UserId);
            b.HasOne<UserRecord>().WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RefreshTokenRecord>(b =>
        {
            b.ToTable("refresh_tokens");
            b.HasKey(t => t.Id);
            b.Property(t => t.TokenHash).HasMaxLength(64);
            b.HasIndex(t => t.TokenHash).IsUnique();
            b.HasIndex(t => t.UserId);
            b.HasOne<UserRecord>().WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GameRecord>(b =>
        {
            b.ToTable("games");
            b.HasKey(g => g.Id);
            b.Property(g => g.Result).HasConversion<string>().HasMaxLength(32);
            b.Property(g => g.Status).HasMaxLength(32);
            b.HasMany(g => g.Players)
                .WithOne(p => p.GameRecord)
                .HasForeignKey(p => p.GameRecordId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GamePlayerRecord>(b =>
        {
            b.ToTable("game_players");
            b.HasKey(p => p.Id);
            b.Property(p => p.DisplayName).HasMaxLength(64);
            b.Property(p => p.Role).HasConversion<string>().HasMaxLength(32);
            b.Property(p => p.EliminatedBy).HasConversion<string>().HasMaxLength(16);
            b.HasIndex(p => p.UserId);
        });

        modelBuilder.Entity<PlayerStatsRecord>(b =>
        {
            b.ToTable("player_stats");
            b.HasKey(x => x.UserId);
            b.Property(x => x.Username).HasMaxLength(256);
            b.Property(x => x.Language).HasMaxLength(8);
            b.Property(x => x.ReminderTime).HasMaxLength(5);
            b.HasIndex(x => x.Rating);
        });

        modelBuilder.Entity<PuzzleResultRecord>(b =>
        {
            b.ToTable("puzzle_results");
            b.HasKey(x => x.Id);
            b.Property(x => x.Game).HasMaxLength(16);
            b.Property(x => x.Mode).HasMaxLength(16);
            b.HasIndex(x => new { x.UserId, x.Game, x.Day });
            b.HasIndex(x => new { x.Game, x.PuzzleNumber });
            b.HasIndex(x => x.Day);
        });

        modelBuilder.Entity<CoupleRecord>(b =>
        {
            b.ToTable("couples");
            b.HasKey(x => x.Id);
            b.Property(x => x.InviteToken).HasMaxLength(32);
            b.Property(x => x.ReminderTime).HasMaxLength(5);
            b.Property(x => x.Language).HasMaxLength(8);
            b.HasIndex(x => x.InviteToken).IsUnique();
            b.HasIndex(x => x.InviterId);
            b.HasIndex(x => x.PartnerId);
        });

        modelBuilder.Entity<CoupleAnswerRecord>(b =>
        {
            b.ToTable("couple_answers");
            b.HasKey(x => x.Id);
            b.Property(x => x.Answers).HasMaxLength(32);
            b.HasIndex(x => new { x.CoupleId, x.Day, x.UserId }).IsUnique();
        });

        modelBuilder.Entity<MafiaTableRecord>(b =>
        {
            b.ToTable("mafia_tables");
            b.HasKey(x => x.GameId);
            b.Property(x => x.Name).HasMaxLength(40);
            b.Property(x => x.InviteCode).HasMaxLength(8);
            b.HasIndex(x => x.InviteCode).IsUnique();
            b.HasIndex(x => new { x.IsOpen, x.CreatedAt });
        });

        modelBuilder.Entity<AppSettingsRecord>(b => { b.ToTable("app_settings"); b.HasKey(x => x.Id); b.Property(x => x.DisabledGamesJson).HasDefaultValue("[]"); });
        modelBuilder.Entity<OperationalEventRecord>(b => { b.ToTable("operational_events"); b.HasKey(x => x.Id); b.HasIndex(x => x.CreatedAt); });

        modelBuilder.Entity<UserActivityEventRecord>(b =>
        {
            b.ToTable("user_activity_events");
            b.HasKey(x => x.Id);
            b.Property(x => x.Flow).HasMaxLength(32);
            b.Property(x => x.Name).HasMaxLength(64);
            b.HasIndex(x => new { x.Flow, x.Name, x.CreatedAt });
            b.HasIndex(x => x.UserId);
        });
    }
}
