using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Rag.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPdfPageChunkRelations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PdfPageId",
                table: "RagDocumentChunks",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PdfSourceId",
                table: "RagDocumentChunks",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PdfPages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PdfSourceId = table.Column<int>(type: "integer", nullable: false),
                    PageNumber = table.Column<int>(type: "integer", nullable: false),
                    Text = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PdfPages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PdfPages_PdfSources_PdfSourceId",
                        column: x => x.PdfSourceId,
                        principalTable: "PdfSources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql("""
                UPDATE "RagDocumentChunks" AS c SET "PdfSourceId" = p."Id"
                FROM "PdfSources" AS p
                WHERE c."SourceType" = 2 AND c."SourceId" = p."Id" AND c."PdfSourceId" IS NULL;
                """);
            migrationBuilder.CreateIndex(
                name: "IX_RagDocumentChunks_PdfPageId",
                table: "RagDocumentChunks",
                column: "PdfPageId");

            migrationBuilder.CreateIndex(
                name: "IX_RagDocumentChunks_PdfSourceId",
                table: "RagDocumentChunks",
                column: "PdfSourceId");

            migrationBuilder.CreateIndex(
                name: "IX_PdfPages_PdfSourceId_PageNumber",
                table: "PdfPages",
                columns: new[] { "PdfSourceId", "PageNumber" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_RagDocumentChunks_PdfPages_PdfPageId",
                table: "RagDocumentChunks",
                column: "PdfPageId",
                principalTable: "PdfPages",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RagDocumentChunks_PdfSources_PdfSourceId",
                table: "RagDocumentChunks",
                column: "PdfSourceId",
                principalTable: "PdfSources",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RagDocumentChunks_PdfPages_PdfPageId",
                table: "RagDocumentChunks");

            migrationBuilder.DropForeignKey(
                name: "FK_RagDocumentChunks_PdfSources_PdfSourceId",
                table: "RagDocumentChunks");

            migrationBuilder.DropTable(
                name: "PdfPages");

            migrationBuilder.DropIndex(
                name: "IX_RagDocumentChunks_PdfPageId",
                table: "RagDocumentChunks");

            migrationBuilder.DropIndex(
                name: "IX_RagDocumentChunks_PdfSourceId",
                table: "RagDocumentChunks");

            migrationBuilder.DropColumn(
                name: "PdfPageId",
                table: "RagDocumentChunks");

            migrationBuilder.DropColumn(
                name: "PdfSourceId",
                table: "RagDocumentChunks");
        }
    }
}
