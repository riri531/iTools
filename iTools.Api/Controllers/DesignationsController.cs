using System.Security.Claims;
using iTools.Api.Data;
using iTools.Api.DTOs;
using iTools.Api.Models;
using iTools.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace iTools.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DesignationsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ArchiveService _archiveService;
        private readonly IWebHostEnvironment _environment;

        private static readonly string[] AllowedImageContentTypes =
        {
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "image/gif"
        };

        public DesignationsController(
            ApplicationDbContext context,
            ArchiveService archiveService,
            IWebHostEnvironment environment)
        {
            _context = context;
            _archiveService = archiveService;
            _environment = environment;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<DesignationDto>>> GetAll()
        {
            var designations = await _context.Designations
                .OrderBy(d => d.Id)
                .Select(d => new DesignationDto
                {
                    Id = d.Id,
                    Name = d.Name,
                    Type = d.Type,
                    ImageUrl = d.ImageUrl,
                    CreatedAt = d.CreatedAt,
                    UpdatedAt = d.UpdatedAt
                })
                .ToListAsync();

            return Ok(designations);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<DesignationDto>> GetById(int id)
        {
            var designation = await _context.Designations.FindAsync(id);

            if (designation == null)
            {
                return NotFound("Désignation introuvable.");
            }

            return Ok(ToDto(designation));
        }

        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<DesignationDto>> Create([FromForm] CreateDesignationDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                return BadRequest("Le nom de la désignation est obligatoire.");
            }

            var name = dto.Name.Trim();

            var exists = await _context.Designations
                .AnyAsync(d => d.Name == name);

            if (exists)
            {
                return BadRequest("Cette désignation existe déjà.");
            }

            var imageUrl = await SaveImageAsync(dto.Image);

            var designation = new Designation
            {
                Name = name,
                Type = NormalizeType(dto.Type),
                ImageUrl = imageUrl,
                CreatedAt = dto.CreatedAt ?? DateTime.UtcNow,
                UpdatedAt = null
            };

            _context.Designations.Add(designation);
            await _context.SaveChangesAsync();

            await _archiveService.AddAsync(
                action: "CREATE",
                entityName: "Designation",
                entityId: designation.Id,
                description: $"Ajout de la désignation : {designation.Name}",
                oldValues: null,
                newValues: new
                {
                    designation.Id,
                    designation.Name,
                    designation.Type,
                    designation.ImageUrl,
                    designation.CreatedAt,
                    designation.UpdatedAt
                }
            );

            return CreatedAtAction(nameof(GetById), new { id = designation.Id }, ToDto(designation));
        }

        [HttpPut("{id}")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Update(int id, [FromForm] UpdateDesignationDto dto)
        {
            var designation = await _context.Designations.FindAsync(id);

            if (designation == null)
            {
                return NotFound("Désignation introuvable.");
            }

            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                return BadRequest("Le nom de la désignation est obligatoire.");
            }

            var name = dto.Name.Trim();

            var exists = await _context.Designations
                .AnyAsync(d => d.Name == name && d.Id != id);

            if (exists)
            {
                return BadRequest("Cette désignation existe déjà.");
            }

            var oldValues = new
            {
                designation.Id,
                designation.Name,
                designation.Type,
                designation.ImageUrl,
                designation.CreatedAt,
                designation.UpdatedAt
            };

            if (dto.RemoveImage && !string.IsNullOrWhiteSpace(designation.ImageUrl))
            {
                DeleteImageFile(designation.ImageUrl);
                designation.ImageUrl = null;
            }

            if (dto.Image != null)
            {
                if (!string.IsNullOrWhiteSpace(designation.ImageUrl))
                {
                    DeleteImageFile(designation.ImageUrl);
                }

                designation.ImageUrl = await SaveImageAsync(dto.Image);
            }

            designation.Name = name;
            designation.Type = NormalizeType(dto.Type);
            designation.CreatedAt = dto.CreatedAt ?? designation.CreatedAt;
            designation.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            var newValues = new
            {
                designation.Id,
                designation.Name,
                designation.Type,
                designation.ImageUrl,
                designation.CreatedAt,
                designation.UpdatedAt
            };

            await _archiveService.AddAsync(
                action: "UPDATE",
                entityName: "Designation",
                entityId: designation.Id,
                description: $"Modification de la désignation : {designation.Name}",
                oldValues: oldValues,
                newValues: newValues
            );

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var designation = await _context.Designations.FindAsync(id);

            if (designation == null)
            {
                return NotFound("Désignation introuvable.");
            }

            var oldValues = new
            {
                designation.Id,
                designation.Name,
                designation.Type,
                designation.ImageUrl,
                designation.CreatedAt,
                designation.UpdatedAt
            };

            if (!string.IsNullOrWhiteSpace(designation.ImageUrl))
            {
                DeleteImageFile(designation.ImageUrl);
            }

            _context.Designations.Remove(designation);
            await _context.SaveChangesAsync();

            await _archiveService.AddAsync(
                action: "DELETE",
                entityName: "Designation",
                entityId: id,
                description: $"Suppression de la désignation : {oldValues.Name}",
                oldValues: oldValues,
                newValues: null
            );

            return NoContent();
        }

        [HttpGet("{id}/identity-card")]
        public async Task<IActionResult> DownloadIdentityCard(int id)
        {
            if (!CanDownloadIdentityCard())
            {
                return Forbid();
            }

            var designation = await _context.Designations.FindAsync(id);

            if (designation == null)
            {
                return NotFound("Désignation introuvable.");
            }

            QuestPDF.Settings.License = LicenseType.Community;

            var pdfBytes = BuildDesignationPdf(designation);
            var fileName = $"fiche_designation_{designation.Id}_{SafeFileName(designation.Name)}.pdf";

            await _archiveService.AddAsync(
                action: "DOWNLOAD_PDF",
                entityName: "Designation",
                entityId: designation.Id,
                description: $"Téléchargement de la fiche PDF de la désignation : {designation.Name}",
                oldValues: null,
                newValues: new
                {
                    designation.Id,
                    designation.Name,
                    designation.Type,
                    designation.ImageUrl,
                    designation.CreatedAt,
                    designation.UpdatedAt
                }
            );

            return File(pdfBytes, "application/pdf", fileName);
        }

        private DesignationDto ToDto(Designation designation)
        {
            return new DesignationDto
            {
                Id = designation.Id,
                Name = designation.Name,
                Type = designation.Type,
                ImageUrl = designation.ImageUrl,
                CreatedAt = designation.CreatedAt,
                UpdatedAt = designation.UpdatedAt
            };
        }

        private async Task<string?> SaveImageAsync(IFormFile? image)
        {
            if (image == null || image.Length == 0)
            {
                return null;
            }

            if (!AllowedImageContentTypes.Contains(image.ContentType.ToLowerInvariant()))
            {
                throw new InvalidOperationException("Le fichier sélectionné doit être une image valide.");
            }

            const long maxSize = 5 * 1024 * 1024;

            if (image.Length > maxSize)
            {
                throw new InvalidOperationException("La taille de l’image ne doit pas dépasser 5 Mo.");
            }

            var webRoot = GetWebRootPath();
            var uploadFolder = Path.Combine(webRoot, "uploads", "designations");

            if (!Directory.Exists(uploadFolder))
            {
                Directory.CreateDirectory(uploadFolder);
            }

            var extension = Path.GetExtension(image.FileName).ToLowerInvariant();

            if (string.IsNullOrWhiteSpace(extension))
            {
                extension = ".png";
            }

            var fileName = $"{Guid.NewGuid():N}{extension}";
            var filePath = Path.Combine(uploadFolder, fileName);

            await using var stream = new FileStream(filePath, FileMode.Create);
            await image.CopyToAsync(stream);

            return $"/uploads/designations/{fileName}";
        }

        private void DeleteImageFile(string imageUrl)
        {
            if (string.IsNullOrWhiteSpace(imageUrl))
            {
                return;
            }

            var relativePath = imageUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var filePath = Path.Combine(GetWebRootPath(), relativePath);

            if (System.IO.File.Exists(filePath))
            {
                System.IO.File.Delete(filePath);
            }
        }

        private string GetWebRootPath()
        {
            if (!string.IsNullOrWhiteSpace(_environment.WebRootPath))
            {
                return _environment.WebRootPath;
            }

            var webRoot = Path.Combine(_environment.ContentRootPath, "wwwroot");

            if (!Directory.Exists(webRoot))
            {
                Directory.CreateDirectory(webRoot);
            }

            return webRoot;
        }

        private string NormalizeType(string? type)
        {
            if (string.IsNullOrWhiteSpace(type))
            {
                return "Général";
            }

            return type.Trim();
        }

        private bool CanDownloadIdentityCard()
        {
            var role =
                User.FindFirst(ClaimTypes.Role)?.Value ??
                User.FindFirst("role")?.Value ??
                User.FindFirst("Role")?.Value ??
                string.Empty;

            role = role.Trim().ToUpperInvariant();

            return role == "ADMIN" || role == "RESPONSABLE" || role == "EMPLOYE" || role == "EMPLOYÉ";
        }

        private byte[] BuildDesignationPdf(Designation designation)
        {
            var photoPath = GetPhysicalImagePath(designation.ImageUrl);

            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(36);
                    page.DefaultTextStyle(text => text.FontSize(11).FontFamily("Arial"));

                    page.Header().Column(column =>
                    {
                        column.Item()
                            .Background(Colors.Red.Darken3)
                            .Padding(18)
                            .Column(header =>
                            {
                                header.Item().Text("FICHE D'IDENTITE - DESIGNATION")
                                    .FontSize(22)
                                    .Bold()
                                    .FontColor(Colors.White);

                                header.Item().PaddingTop(5).Text("iTools - Gestion des outils")
                                    .FontSize(10)
                                    .FontColor(Colors.White);
                            });
                    });

                    page.Content().PaddingTop(22).Column(column =>
                    {
                        column.Spacing(16);

                        column.Item().Row(row =>
                        {
                            row.RelativeItem(2).Column(info =>
                            {
                                info.Spacing(10);

                                info.Item().Text(designation.Name)
                                    .FontSize(24)
                                    .Bold()
                                    .FontColor(Colors.Blue.Darken4);

                                info.Item().Text($"Type : {designation.Type}")
                                    .FontSize(13)
                                    .SemiBold()
                                    .FontColor(Colors.Red.Darken2);

                                info.Item().Text($"Identifiant : {designation.Id}")
                                    .FontSize(11)
                                    .FontColor(Colors.Grey.Darken2);
                            });

                            row.RelativeItem(1).Element(container =>
                            {
                                if (!string.IsNullOrWhiteSpace(photoPath) && System.IO.File.Exists(photoPath))
                                {
                                    container
                                        .Height(135)
                                        .Border(1)
                                        .BorderColor(Colors.Grey.Lighten2)
                                        .Padding(5)
                                        .Image(photoPath)
                                        .FitArea();
                                }
                                else
                                {
                                    container
                                        .Height(135)
                                        .Background(Colors.Grey.Lighten4)
                                        .Border(1)
                                        .BorderColor(Colors.Grey.Lighten2)
                                        .AlignCenter()
                                        .AlignMiddle()
                                        .Text("Aucune photo")
                                        .FontColor(Colors.Grey.Darken1)
                                        .SemiBold();
                                }
                            });
                        });

                        column.Item().PaddingTop(6).Text("Informations principales")
                            .FontSize(15)
                            .Bold()
                            .FontColor(Colors.Red.Darken2);

                        column.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(2);
                            });

                            AddInfoRow(table, "ID", designation.Id.ToString());
                            AddInfoRow(table, "Nom designation", designation.Name);
                            AddInfoRow(table, "Type", designation.Type);
                            AddInfoRow(table, "Photo", string.IsNullOrWhiteSpace(designation.ImageUrl) ? "Non disponible" : designation.ImageUrl);
                            AddInfoRow(table, "Date de creation", FormatDate(designation.CreatedAt));
                            AddInfoRow(table, "Derniere modification", designation.UpdatedAt.HasValue ? FormatDate(designation.UpdatedAt.Value) : "Non modifiee");
                        });

                        column.Item().PaddingTop(8).Text("Historique de l'element")
                            .FontSize(15)
                            .Bold()
                            .FontColor(Colors.Red.Darken2);

                        column.Item()
                            .Background(Colors.Grey.Lighten4)
                            .Border(1)
                            .BorderColor(Colors.Grey.Lighten2)
                            .Padding(14)
                            .Column(history =>
                            {
                                history.Spacing(7);

                                history.Item().Text($"Creation : {FormatDate(designation.CreatedAt)}")
                                    .FontSize(11)
                                    .SemiBold();

                                history.Item().Text(designation.UpdatedAt.HasValue
                                        ? $"Modification : {FormatDate(designation.UpdatedAt.Value)}"
                                        : "Modification : aucune modification renseignee")
                                    .FontSize(11)
                                    .SemiBold();

                                history.Item().Text("Cette fiche resume les informations actuelles de la designation ainsi que les dates principales de son cycle de vie.")
                                    .FontSize(10)
                                    .FontColor(Colors.Grey.Darken2);
                            });

                        column.Item().PaddingTop(10)
                            .Background(Colors.Purple.Lighten5)
                            .Border(1)
                            .BorderColor(Colors.Purple.Lighten3)
                            .Padding(12)
                            .Text("Document genere automatiquement depuis iTools. Bouton disponible pour les profils ADMIN et RESPONSABLE.")
                            .FontSize(10)
                            .FontColor(Colors.Purple.Darken3);
                    });

                    page.Footer()
                        .AlignCenter()
                        .Text(text =>
                        {
                            text.Span("iTools - Fiche designation - Page ");
                            text.CurrentPageNumber();
                            text.Span(" / ");
                            text.TotalPages();
                        });
                });
            }).GeneratePdf();
        }

        private void AddInfoRow(TableDescriptor table, string label, string value)
        {
            table.Cell().Element(CellLabelStyle).Text(label).SemiBold();
            table.Cell().Element(CellValueStyle).Text(value);
        }

        private IContainer CellLabelStyle(IContainer container)
        {
            return container
                .Border(1)
                .BorderColor(Colors.Grey.Lighten2)
                .Background(Colors.Grey.Lighten4)
                .Padding(8);
        }

        private IContainer CellValueStyle(IContainer container)
        {
            return container
                .Border(1)
                .BorderColor(Colors.Grey.Lighten2)
                .Padding(8);
        }

        private string? GetPhysicalImagePath(string? imageUrl)
        {
            if (string.IsNullOrWhiteSpace(imageUrl))
            {
                return null;
            }

            if (imageUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            var relativePath = imageUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            return Path.Combine(GetWebRootPath(), relativePath);
        }

        private string FormatDate(DateTime date)
        {
            return date.ToLocalTime().ToString("dd/MM/yyyy HH:mm");
        }

        private string SafeFileName(string value)
        {
            var invalidChars = Path.GetInvalidFileNameChars();

            var cleaned = new string(value
                .Select(ch => invalidChars.Contains(ch) ? '_' : ch)
                .ToArray());

            cleaned = cleaned.Trim();

            if (string.IsNullOrWhiteSpace(cleaned))
            {
                return "designation";
            }

            return cleaned.Replace(' ', '_');
        }
    }
}