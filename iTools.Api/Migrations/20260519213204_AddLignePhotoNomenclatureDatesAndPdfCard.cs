using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iTools.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLignePhotoNomenclatureDatesAndPdfCard : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Lignes",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "Lignes",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Nomenclature",
                table: "Lignes",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Lignes",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Lignes");

            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "Lignes");

            migrationBuilder.DropColumn(
                name: "Nomenclature",
                table: "Lignes");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Lignes");
        }
    }
}
