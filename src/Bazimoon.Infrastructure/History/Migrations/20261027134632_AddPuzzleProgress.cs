using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bazimoon.Infrastructure.History.Migrations
{
    /// <inheritdoc />
    public partial class AddPuzzleProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "puzzle_progress",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Game = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Track = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Level = table.Column<int>(type: "integer", nullable: false),
                    SavedLevel = table.Column<int>(type: "integer", nullable: true),
                    SavedState = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_puzzle_progress", x => new { x.UserId, x.Game, x.Track });
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "puzzle_progress");
        }
    }
}
