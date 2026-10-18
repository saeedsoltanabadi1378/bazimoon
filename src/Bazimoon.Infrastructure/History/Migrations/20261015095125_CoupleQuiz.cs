using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Bazimoon.Infrastructure.History.Migrations
{
    /// <inheritdoc />
    public partial class CoupleQuiz : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "couple_answers",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CoupleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Day = table.Column<int>(type: "integer", nullable: false),
                    TelegramUserId = table.Column<long>(type: "bigint", nullable: false),
                    Answers = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_couple_answers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "couples",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InviterId = table.Column<long>(type: "bigint", nullable: false),
                    PartnerId = table.Column<long>(type: "bigint", nullable: true),
                    InviteToken = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    InviteExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    StartDay = table.Column<int>(type: "integer", nullable: true),
                    ReminderTime = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    Language = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Streak = table.Column<int>(type: "integer", nullable: false),
                    BestStreak = table.Column<int>(type: "integer", nullable: false),
                    LastBothDay = table.Column<int>(type: "integer", nullable: true),
                    TotalMatches = table.Column<int>(type: "integer", nullable: false),
                    TotalQuestions = table.Column<int>(type: "integer", nullable: false),
                    InviterNudgedDay = table.Column<int>(type: "integer", nullable: true),
                    PartnerNudgedDay = table.Column<int>(type: "integer", nullable: true),
                    LastReminderDay = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_couples", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_couple_answers_CoupleId_Day_TelegramUserId",
                table: "couple_answers",
                columns: new[] { "CoupleId", "Day", "TelegramUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_couples_InviterId",
                table: "couples",
                column: "InviterId");

            migrationBuilder.CreateIndex(
                name: "IX_couples_InviteToken",
                table: "couples",
                column: "InviteToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_couples_PartnerId",
                table: "couples",
                column: "PartnerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "couple_answers");

            migrationBuilder.DropTable(
                name: "couples");
        }
    }
}
