using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Bazimoon.Infrastructure.History.Migrations
{
    /// <inheritdoc />
    public partial class AddClans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ClanId",
                table: "mafia_tables",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "clans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    NameKey = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    Bio = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: true),
                    Emblem = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Color = table.Column<string>(type: "character varying(9)", maxLength: 9, nullable: false),
                    IsListed = table.Column<bool>(type: "boolean", nullable: false),
                    InviteCode = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastTableNoticeAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "clan_bans",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ClanId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clan_bans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_clan_bans_clans_ClanId",
                        column: x => x.ClanId,
                        principalTable: "clans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_clan_bans_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "clan_events",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ClanId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Seats = table.Column<int>(type: "integer", nullable: false),
                    RepeatWeekly = table.Column<bool>(type: "boolean", nullable: false),
                    Cancelled = table.Column<bool>(type: "boolean", nullable: false),
                    GameId = table.Column<Guid>(type: "uuid", nullable: true),
                    HourReminderSent = table.Column<bool>(type: "boolean", nullable: false),
                    StartReminderSent = table.Column<bool>(type: "boolean", nullable: false),
                    NextScheduled = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clan_events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_clan_events_clans_ClanId",
                        column: x => x.ClanId,
                        principalTable: "clans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "clan_join_requests",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ClanId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clan_join_requests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_clan_join_requests_clans_ClanId",
                        column: x => x.ClanId,
                        principalTable: "clans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_clan_join_requests_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "clan_members",
                columns: table => new
                {
                    ClanId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Role = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastReadMessageId = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clan_members", x => new { x.ClanId, x.UserId });
                    table.ForeignKey(
                        name: "FK_clan_members_clans_ClanId",
                        column: x => x.ClanId,
                        principalTable: "clans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_clan_members_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "clan_messages",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ClanId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    IsAnnouncement = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clan_messages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_clan_messages_clans_ClanId",
                        column: x => x.ClanId,
                        principalTable: "clans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_clan_messages_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "clan_rsvps",
                columns: table => new
                {
                    EventId = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Answer = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clan_rsvps", x => new { x.EventId, x.UserId });
                    table.ForeignKey(
                        name: "FK_clan_rsvps_clan_events_EventId",
                        column: x => x.EventId,
                        principalTable: "clan_events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_clan_rsvps_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_mafia_tables_ClanId",
                table: "mafia_tables",
                column: "ClanId");

            migrationBuilder.CreateIndex(
                name: "IX_clan_bans_ClanId_UserId",
                table: "clan_bans",
                columns: new[] { "ClanId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_clan_bans_UserId",
                table: "clan_bans",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_clan_events_Cancelled_StartsAt",
                table: "clan_events",
                columns: new[] { "Cancelled", "StartsAt" });

            migrationBuilder.CreateIndex(
                name: "IX_clan_events_ClanId_StartsAt",
                table: "clan_events",
                columns: new[] { "ClanId", "StartsAt" });

            migrationBuilder.CreateIndex(
                name: "IX_clan_join_requests_ClanId_UserId",
                table: "clan_join_requests",
                columns: new[] { "ClanId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_clan_join_requests_UserId",
                table: "clan_join_requests",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_clan_members_UserId",
                table: "clan_members",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_clan_messages_ClanId_Id",
                table: "clan_messages",
                columns: new[] { "ClanId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_clan_messages_ClanId_IsAnnouncement_Id",
                table: "clan_messages",
                columns: new[] { "ClanId", "IsAnnouncement", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_clan_messages_UserId",
                table: "clan_messages",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_clan_rsvps_UserId",
                table: "clan_rsvps",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_clans_InviteCode",
                table: "clans",
                column: "InviteCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_clans_IsListed",
                table: "clans",
                column: "IsListed");

            migrationBuilder.CreateIndex(
                name: "IX_clans_NameKey",
                table: "clans",
                column: "NameKey",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "clan_bans");

            migrationBuilder.DropTable(
                name: "clan_join_requests");

            migrationBuilder.DropTable(
                name: "clan_members");

            migrationBuilder.DropTable(
                name: "clan_messages");

            migrationBuilder.DropTable(
                name: "clan_rsvps");

            migrationBuilder.DropTable(
                name: "clan_events");

            migrationBuilder.DropTable(
                name: "clans");

            migrationBuilder.DropIndex(
                name: "IX_mafia_tables_ClanId",
                table: "mafia_tables");

            migrationBuilder.DropColumn(
                name: "ClanId",
                table: "mafia_tables");
        }
    }
}
