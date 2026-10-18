using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bazimoon.Infrastructure.History.Migrations
{
    /// <inheritdoc />
    public partial class AddUserBotReason : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "BotMarkedAt",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BotMarkedBy",
                table: "users",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BotReason",
                table: "users",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BotMarkedAt",
                table: "users");

            migrationBuilder.DropColumn(
                name: "BotMarkedBy",
                table: "users");

            migrationBuilder.DropColumn(
                name: "BotReason",
                table: "users");
        }
    }
}
