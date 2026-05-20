using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iTools.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDesignationDetailsPhotoAndPdfCard : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Designations",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "Designations",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Type",
                table: "Designations",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Designations",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Designations");

            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "Designations");

            migrationBuilder.DropColumn(
                name: "Type",
                table: "Designations");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Designations");
        }
    }
}
