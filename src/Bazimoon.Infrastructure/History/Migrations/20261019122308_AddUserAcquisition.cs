using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bazimoon.Infrastructure.History.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAcquisition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_acquisitions",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Source = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Medium = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Campaign = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Term = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Content = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Referrer = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    LandingPath = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    Gclid = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    FirstSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_acquisitions", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_user_acquisitions_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_user_acquisitions_FirstSeenAt",
                table: "user_acquisitions",
                column: "FirstSeenAt");

            migrationBuilder.CreateIndex(
                name: "IX_user_acquisitions_Source_Medium",
                table: "user_acquisitions",
                columns: new[] { "Source", "Medium" });

            // Existing players predate first-touch capture. Keep them queryable alongside new
            // players without inventing an acquisition source for them.
            migrationBuilder.Sql("""
                INSERT INTO user_acquisitions ("UserId", "Source", "Medium", "FirstSeenAt")
                SELECT "Id", 'unknown', 'none', "CreatedAt"
                FROM users;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_acquisitions");
        }
    }
}
