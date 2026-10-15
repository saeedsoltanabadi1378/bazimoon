using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nightfall.Infrastructure.History.Migrations
{
    /// <inheritdoc />
    public partial class AdminBilingualSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "chat_profiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HelpMessageFa",
                table: "bot_settings",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "MaintenanceMessageFa",
                table: "bot_settings",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ReminderMessage",
                table: "bot_settings",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ReminderMessageFa",
                table: "bot_settings",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "WelcomeMessageFa",
                table: "bot_settings",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Title",
                table: "chat_profiles");

            migrationBuilder.DropColumn(
                name: "HelpMessageFa",
                table: "bot_settings");

            migrationBuilder.DropColumn(
                name: "MaintenanceMessageFa",
                table: "bot_settings");

            migrationBuilder.DropColumn(
                name: "ReminderMessage",
                table: "bot_settings");

            migrationBuilder.DropColumn(
                name: "ReminderMessageFa",
                table: "bot_settings");

            migrationBuilder.DropColumn(
                name: "WelcomeMessageFa",
                table: "bot_settings");
        }
    }
}
