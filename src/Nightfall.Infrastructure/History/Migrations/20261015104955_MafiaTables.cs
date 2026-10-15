using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nightfall.Infrastructure.History.Migrations
{
    /// <inheritdoc />
    public partial class MafiaTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "mafia_tables",
                columns: table => new
                {
                    GameId = table.Column<Guid>(type: "uuid", nullable: false),
                    TelegramChatId = table.Column<long>(type: "bigint", nullable: false),
                    CreatorTelegramUserId = table.Column<long>(type: "bigint", nullable: false),
                    Name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    IsOpen = table.Column<bool>(type: "boolean", nullable: false),
                    InviteCode = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mafia_tables", x => x.GameId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_mafia_tables_InviteCode",
                table: "mafia_tables",
                column: "InviteCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_mafia_tables_IsOpen_CreatedAt",
                table: "mafia_tables",
                columns: new[] { "IsOpen", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_mafia_tables_TelegramChatId",
                table: "mafia_tables",
                column: "TelegramChatId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "mafia_tables");
        }
    }
}
