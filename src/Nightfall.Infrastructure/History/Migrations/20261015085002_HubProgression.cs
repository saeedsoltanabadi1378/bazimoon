using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Nightfall.Infrastructure.History.Migrations
{
    /// <inheritdoc />
    public partial class HubProgression : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EliminatedBy",
                table: "game_players",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EliminatedRound",
                table: "game_players",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RatingBefore",
                table: "game_players",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RatingDelta",
                table: "game_players",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "WasPromoted",
                table: "game_players",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "Won",
                table: "game_players",
                type: "boolean",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "chat_members",
                columns: table => new
                {
                    TelegramChatId = table.Column<long>(type: "bigint", nullable: false),
                    TelegramUserId = table.Column<long>(type: "bigint", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chat_members", x => new { x.TelegramChatId, x.TelegramUserId });
                });

            migrationBuilder.CreateTable(
                name: "player_stats",
                columns: table => new
                {
                    TelegramUserId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Username = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Xp = table.Column<int>(type: "integer", nullable: false),
                    Rating = table.Column<int>(type: "integer", nullable: false),
                    PuzzleStreak = table.Column<int>(type: "integer", nullable: false),
                    BestPuzzleStreak = table.Column<int>(type: "integer", nullable: false),
                    LastPuzzleDay = table.Column<int>(type: "integer", nullable: true),
                    StreakFreezes = table.Column<int>(type: "integer", nullable: false),
                    Language = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    ReminderEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ReminderTime = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    HighContrast = table.Column<bool>(type: "boolean", nullable: false),
                    Haptics = table.Column<bool>(type: "boolean", nullable: false),
                    LastReminderDay = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_player_stats", x => x.TelegramUserId);
                });

            migrationBuilder.CreateTable(
                name: "puzzle_results",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TelegramUserId = table.Column<long>(type: "bigint", nullable: false),
                    Game = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Mode = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    PuzzleNumber = table.Column<int>(type: "integer", nullable: true),
                    Day = table.Column<int>(type: "integer", nullable: false),
                    Solved = table.Column<bool>(type: "boolean", nullable: false),
                    TimeMs = table.Column<int>(type: "integer", nullable: true),
                    Score = table.Column<int>(type: "integer", nullable: true),
                    Moves = table.Column<int>(type: "integer", nullable: true),
                    Detail = table.Column<int>(type: "integer", nullable: true),
                    Hints = table.Column<int>(type: "integer", nullable: false),
                    XpGained = table.Column<int>(type: "integer", nullable: false),
                    Points = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_puzzle_results", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_game_players_TelegramUserId",
                table: "game_players",
                column: "TelegramUserId");

            migrationBuilder.CreateIndex(
                name: "IX_chat_members_TelegramUserId",
                table: "chat_members",
                column: "TelegramUserId");

            migrationBuilder.CreateIndex(
                name: "IX_player_stats_Rating",
                table: "player_stats",
                column: "Rating");

            migrationBuilder.CreateIndex(
                name: "IX_puzzle_results_Day",
                table: "puzzle_results",
                column: "Day");

            migrationBuilder.CreateIndex(
                name: "IX_puzzle_results_Game_PuzzleNumber",
                table: "puzzle_results",
                columns: new[] { "Game", "PuzzleNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_puzzle_results_TelegramUserId_Game_Day",
                table: "puzzle_results",
                columns: new[] { "TelegramUserId", "Game", "Day" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "chat_members");

            migrationBuilder.DropTable(
                name: "player_stats");

            migrationBuilder.DropTable(
                name: "puzzle_results");

            migrationBuilder.DropIndex(
                name: "IX_game_players_TelegramUserId",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "EliminatedBy",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "EliminatedRound",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "RatingBefore",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "RatingDelta",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "WasPromoted",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "Won",
                table: "game_players");
        }
    }
}
