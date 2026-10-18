using Microsoft.EntityFrameworkCore;
using Bazimoon.Infrastructure.Admin;
using Bazimoon.Infrastructure.Hub;

namespace Bazimoon.Infrastructure.History;

public sealed class BazimoonDbContext : DbContext
{
    public BazimoonDbContext(DbContextOptions<BazimoonDbContext> options) : base(options)
    {
    }

    public DbSet<GameRecord> Games => Set<GameRecord>();
    public DbSet<GamePlayerRecord> GamePlayers => Set<GamePlayerRecord>();
    public DbSet<BotSettingsRecord> BotSettings => Set<BotSettingsRecord>();
    public DbSet<UserProfileRecord> UserProfiles => Set<UserProfileRecord>();
    public DbSet<ChatProfileRecord> ChatProfiles => Set<ChatProfileRecord>();
    public DbSet<OperationalEventRecord> OperationalEvents => Set<OperationalEventRecord>();
    public DbSet<PlayerStatsRecord> PlayerStats => Set<PlayerStatsRecord>();
    public DbSet<PuzzleResultRecord> PuzzleResults => Set<PuzzleResultRecord>();
    public DbSet<ChatMemberRecord> ChatMembers => Set<ChatMemberRecord>();
    public DbSet<CoupleRecord> Couples => Set<CoupleRecord>();
    public DbSet<CoupleAnswerRecord> CoupleAnswers => Set<CoupleAnswerRecord>();
    public DbSet<MafiaTableRecord> MafiaTables => Set<MafiaTableRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<GameRecord>(b =>
        {
            b.ToTable("games");
            b.HasKey(g => g.Id);
            b.HasIndex(g => g.TelegramChatId);
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
            b.Property(p => p.TelegramUsername).HasMaxLength(256);
            b.Property(p => p.Role).HasConversion<string>().HasMaxLength(32);
            b.Property(p => p.EliminatedBy).HasConversion<string>().HasMaxLength(16);
            b.HasIndex(p => p.TelegramUserId);
        });

        modelBuilder.Entity<PlayerStatsRecord>(b =>
        {
            b.ToTable("player_stats");
            b.HasKey(x => x.TelegramUserId);
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
            b.HasIndex(x => new { x.TelegramUserId, x.Game, x.Day });
            b.HasIndex(x => new { x.Game, x.PuzzleNumber });
            b.HasIndex(x => x.Day);
        });

        modelBuilder.Entity<ChatMemberRecord>(b =>
        {
            b.ToTable("chat_members");
            b.HasKey(x => new { x.TelegramChatId, x.TelegramUserId });
            b.HasIndex(x => x.TelegramUserId);
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
            b.HasIndex(x => new { x.CoupleId, x.Day, x.TelegramUserId }).IsUnique();
        });

        modelBuilder.Entity<MafiaTableRecord>(b =>
        {
            b.ToTable("mafia_tables");
            b.HasKey(x => x.GameId);
            b.Property(x => x.Name).HasMaxLength(40);
            b.Property(x => x.InviteCode).HasMaxLength(8);
            b.HasIndex(x => x.InviteCode).IsUnique();
            b.HasIndex(x => new { x.IsOpen, x.CreatedAt });
            b.HasIndex(x => x.TelegramChatId);
        });

        modelBuilder.Entity<BotSettingsRecord>(b => { b.ToTable("bot_settings"); b.HasKey(x => x.Id); b.Property(x => x.DisabledGamesJson).HasDefaultValue("[]"); });
        modelBuilder.Entity<UserProfileRecord>(b => { b.ToTable("user_profiles"); b.HasKey(x => x.TelegramUserId); b.HasIndex(x => x.Username); });
        modelBuilder.Entity<ChatProfileRecord>(b => { b.ToTable("chat_profiles"); b.HasKey(x => x.TelegramChatId); });
        modelBuilder.Entity<OperationalEventRecord>(b => { b.ToTable("operational_events"); b.HasKey(x => x.Id); b.HasIndex(x => x.CreatedAt); });
    }
}
