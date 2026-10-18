using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nightfall.Infrastructure.History.Migrations
{
    /// <inheritdoc />
    public partial class MafiaGameLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EventsJson",
                table: "games",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ChecksMade",
                table: "game_players",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsMvp",
                table: "game_players",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "KillsBlocked",
                table: "game_players",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "KillsMade",
                table: "game_players",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MafiaFound",
                table: "game_players",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MvpPoints",
                table: "game_players",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "NightsSurvived",
                table: "game_players",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SavesMade",
                table: "game_players",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "SurvivedRevote",
                table: "game_players",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "VotedOutGodfather",
                table: "game_players",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VotesCast",
                table: "game_players",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VotesOnMafia",
                table: "game_players",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EventsJson",
                table: "games");

            migrationBuilder.DropColumn(
                name: "ChecksMade",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "IsMvp",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "KillsBlocked",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "KillsMade",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "MafiaFound",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "MvpPoints",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "NightsSurvived",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "SavesMade",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "SurvivedRevote",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "VotedOutGodfather",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "VotesCast",
                table: "game_players");

            migrationBuilder.DropColumn(
                name: "VotesOnMafia",
                table: "game_players");
        }
    }
}
