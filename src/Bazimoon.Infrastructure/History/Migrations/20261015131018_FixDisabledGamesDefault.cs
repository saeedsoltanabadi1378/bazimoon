using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bazimoon.Infrastructure.History.Migrations
{
    /// <inheritdoc />
    public partial class FixDisabledGamesDefault : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // GameSwitches first shipped with an empty-string default, which is not valid JSON.
            migrationBuilder.Sql("UPDATE bot_settings SET \"DisabledGamesJson\" = '[]' WHERE \"DisabledGamesJson\" = '';");

            migrationBuilder.AlterColumn<string>(
                name: "DisabledGamesJson",
                table: "bot_settings",
                type: "text",
                nullable: false,
                defaultValue: "[]",
                oldClrType: typeof(string),
                oldType: "text");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "DisabledGamesJson",
                table: "bot_settings",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text",
                oldDefaultValue: "[]");
        }
    }
}
