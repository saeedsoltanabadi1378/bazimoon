using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nightfall.Infrastructure.History.Migrations
{
    /// <inheritdoc />
    public partial class GameSwitches : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DisabledGamesJson",
                table: "bot_settings",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DisabledGamesJson",
                table: "bot_settings");
        }
    }
}
