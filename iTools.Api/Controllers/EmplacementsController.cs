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

namespace iTools.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EmplacementsController : ControllerBase
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

    public EmplacementsController(
        ApplicationDbContext context,
        ArchiveService archiveService,
        IWebHostEnvironment environment)
    {
        _context = context;
        _archiveService = archiveService;
        _environment = environment;
    }

    [HttpGet]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<IEnumerable<EmplacementDto>>> GetAll()
    {
        var items = await _context.Emplacements
            .Include(e => e.Matiere)
            .Include(e => e.Designation)
            .OrderBy(e => e.Id)
            .Select(e => new EmplacementDto
            {
                Id = e.Id,
                MatiereId = e.MatiereId,
                MatiereName = e.Matiere != null ? e.Matiere.NomMatiere : "",
                Armoire = e.Armoire,
                Numero = e.Numero,
                DesignationId = e.DesignationId,
                DesignationName = e.Designation != null ? e.Designation.Name : "",
                Status = e.Status,
                ImageUrl = e.ImageUrl,
                CreatedAt = e.CreatedAt,
                UpdatedAt = e.UpdatedAt
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<EmplacementDto>> GetById(int id)
    {
        var item = await _context.Emplacements
            .Include(e => e.Matiere)
            .Include(e => e.Designation)
            .Where(e => e.Id == id)
            .Select(e => new EmplacementDto
            {
                Id = e.Id,
                MatiereId = e.MatiereId,
                MatiereName = e.Matiere != null ? e.Matiere.NomMatiere : "",
                Armoire = e.Armoire,
                Numero = e.Numero,
                DesignationId = e.DesignationId,
                DesignationName = e.Designation != null ? e.Designation.Name : "",
                Status = e.Status,
                ImageUrl = e.ImageUrl,
                CreatedAt = e.CreatedAt,
                UpdatedAt = e.UpdatedAt
            })
            .FirstOrDefaultAsync();

        if (item == null)
        {
            return NotFound("Emplacement introuvable.");
        }

        return Ok(item);
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<EmplacementDto>> Create([FromForm] CreateEmplacementDto dto)
    {
        var validationError = await ValidateDtoAsync(dto.MatiereId, dto.DesignationId, dto.Armoire, dto.Numero, dto.Status);
        if (validationError != null)
        {
            return BadRequest(validationError);
        }

        var armoire = dto.Armoire.Trim();
        var numero = dto.Numero.Trim();
        var status = dto.Status.Trim();

        var exists = await _context.Emplacements.AnyAsync(e =>
            e.MatiereId == dto.MatiereId &&
            e.Armoire == armoire &&
            e.Numero == numero &&
            e.DesignationId == dto.DesignationId);

        if (exists)
        {
            return BadRequest("Cet emplacement existe déjà.");
        }

        var imageUrl = await SaveImageAsync(dto.Image);

        var item = new Emplacement
        {
            MatiereId = dto.MatiereId,
            Armoire = armoire,
            Numero = numero,
            DesignationId = dto.DesignationId,
            Status = status,
            ImageUrl = imageUrl,
            CreatedAt = dto.CreatedAt ?? DateTime.UtcNow,
            UpdatedAt = null
        };

        _context.Emplacements.Add(item);
        await _context.SaveChangesAsync();

        var result = await ToDtoQuery(item.Id).FirstAsync();

        await _archiveService.AddAsync(
            action: "CREATE",
            entityName: "Emplacement",
            entityId: item.Id,
            description: $"Ajout de l’emplacement : {item.Armoire}-{item.Numero}",
            oldValues: null,
            newValues: result
        );

        return CreatedAtAction(nameof(GetById), new { id = item.Id }, result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Update(int id, [FromForm] UpdateEmplacementDto dto)
    {
        var item = await _context.Emplacements
            .Include(e => e.Matiere)
            .Include(e => e.Designation)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (item == null)
        {
            return NotFound("Emplacement introuvable.");
        }

        var validationError = await ValidateDtoAsync(dto.MatiereId, dto.DesignationId, dto.Armoire, dto.Numero, dto.Status);
        if (validationError != null)
        {
            return BadRequest(validationError);
        }

        var armoire = dto.Armoire.Trim();
        var numero = dto.Numero.Trim();
        var status = dto.Status.Trim();

        var exists = await _context.Emplacements.AnyAsync(e =>
            e.MatiereId == dto.MatiereId &&
            e.Armoire == armoire &&
            e.Numero == numero &&
            e.DesignationId == dto.DesignationId &&
            e.Id != id);

        if (exists)
        {
            return BadRequest("Cet emplacement existe déjà.");
        }

        var oldValues = new
        {
            item.Id,
            item.MatiereId,
            MatiereName = item.Matiere != null ? item.Matiere.NomMatiere : "",
            item.Armoire,
            item.Numero,
            item.DesignationId,
            DesignationName = item.Designation != null ? item.Designation.Name : "",
            item.Status,
            item.ImageUrl,
            item.CreatedAt,
            item.UpdatedAt
        };

        if (dto.RemoveImage && !string.IsNullOrWhiteSpace(item.ImageUrl))
        {
            DeleteImageFile(item.ImageUrl);
            item.ImageUrl = null;
        }

        if (dto.Image != null)
        {
            if (!string.IsNullOrWhiteSpace(item.ImageUrl))
            {
                DeleteImageFile(item.ImageUrl);
            }

            item.ImageUrl = await SaveImageAsync(dto.Image);
        }

        item.MatiereId = dto.MatiereId;
        item.Armoire = armoire;
        item.Numero = numero;
        item.DesignationId = dto.DesignationId;
        item.Status = status;
        item.CreatedAt = dto.CreatedAt ?? item.CreatedAt;
        item.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var updatedItem = await _context.Emplacements
            .Include(e => e.Matiere)
            .Include(e => e.Designation)
            .FirstAsync(e => e.Id == id);

        var newValues = new
        {
            updatedItem.Id,
            updatedItem.MatiereId,
            MatiereName = updatedItem.Matiere != null ? updatedItem.Matiere.NomMatiere : "",
            updatedItem.Armoire,
            updatedItem.Numero,
            updatedItem.DesignationId,
            DesignationName = updatedItem.Designation != null ? updatedItem.Designation.Name : "",
            updatedItem.Status,
            updatedItem.ImageUrl,
            updatedItem.CreatedAt,
            updatedItem.UpdatedAt
        };

        await _archiveService.AddAsync(
            action: "UPDATE",
            entityName: "Emplacement",
            entityId: item.Id,
            description: $"Modification de l’emplacement : {item.Armoire}-{item.Numero}",
            oldValues: oldValues,
            newValues: newValues
        );

        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _context.Emplacements
            .Include(e => e.Matiere)
            .Include(e => e.Designation)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (item == null)
        {
            return NotFound("Emplacement introuvable.");
        }

        var oldValues = new
        {
            item.Id,
            item.MatiereId,
            MatiereName = item.Matiere != null ? item.Matiere.NomMatiere : "",
            item.Armoire,
            item.Numero,
            item.DesignationId,
            DesignationName = item.Designation != null ? item.Designation.Name : "",
            item.Status,
            item.ImageUrl,
            item.CreatedAt,
            item.UpdatedAt
        };

        if (!string.IsNullOrWhiteSpace(item.ImageUrl))
        {
            DeleteImageFile(item.ImageUrl);
        }

        _context.Emplacements.Remove(item);
        await _context.SaveChangesAsync();

        await _archiveService.AddAsync(
            action: "DELETE",
            entityName: "Emplacement",
            entityId: id,
            description: $"Suppression de l’emplacement : {oldValues.Armoire}-{oldValues.Numero}",
            oldValues: oldValues,
            newValues: null
        );

        return NoContent();
    }

    [HttpGet("{id}/identity-card")]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<IActionResult> DownloadIdentityCard(int id)
    {
        if (!CanDownloadIdentityCard())
        {
            return Forbid();
        }

        var item = await _context.Emplacements
            .Include(e => e.Matiere)
            .Include(e => e.Designation)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (item == null)
        {
            return NotFound("Emplacement introuvable.");
        }

        var history = await _context.ArchiveLogs
            .Where(a => a.EntityName == "Emplacement" && a.EntityId == item.Id)
            .OrderByDescending(a => a.CreatedAt)
            .Take(10)
            .ToListAsync();

        QuestPDF.Settings.License = LicenseType.Community;

        var pdfBytes = BuildEmplacementPdf(item, history);
        var fileName = $"fiche_emplacement_{item.Id}_{SafeFileName(item.Armoire + "_" + item.Numero)}.pdf";

        await _archiveService.AddAsync(
            action: "DOWNLOAD_PDF",
            entityName: "Emplacement",
            entityId: item.Id,
            description: $"Téléchargement de la fiche PDF de l’emplacement : {item.Armoire}-{item.Numero}",
            oldValues: null,
            newValues: new
            {
                item.Id,
                item.MatiereId,
                MatiereName = item.Matiere != null ? item.Matiere.NomMatiere : "",
                item.Armoire,
                item.Numero,
                item.DesignationId,
                DesignationName = item.Designation != null ? item.Designation.Name : "",
                item.Status,
                item.ImageUrl,
                item.CreatedAt,
                item.UpdatedAt
            }
        );

        return File(pdfBytes, "application/pdf", fileName);
    }

    private IQueryable<EmplacementDto> ToDtoQuery(int id)
    {
        return _context.Emplacements
            .Include(e => e.Matiere)
            .Include(e => e.Designation)
            .Where(e => e.Id == id)
            .Select(e => new EmplacementDto
            {
                Id = e.Id,
                MatiereId = e.MatiereId,
                MatiereName = e.Matiere != null ? e.Matiere.NomMatiere : "",
                Armoire = e.Armoire,
                Numero = e.Numero,
                DesignationId = e.DesignationId,
                DesignationName = e.Designation != null ? e.Designation.Name : "",
                Status = e.Status,
                ImageUrl = e.ImageUrl,
                CreatedAt = e.CreatedAt,
                UpdatedAt = e.UpdatedAt
            });
    }

    private async Task<string?> ValidateDtoAsync(int matiereId, int designationId, string armoire, string numero, string status)
    {
        if (matiereId <= 0)
        {
            return "La matière est obligatoire.";
        }

        if (designationId <= 0)
        {
            return "La désignation est obligatoire.";
        }

        if (string.IsNullOrWhiteSpace(armoire))
        {
            return "L’armoire est obligatoire.";
        }

        if (string.IsNullOrWhiteSpace(numero))
        {
            return "Le numéro est obligatoire.";
        }

        if (string.IsNullOrWhiteSpace(status))
        {
            return "Le statut est obligatoire.";
        }

        var matiereExists = await _context.Matieres.AnyAsync(m => m.Id == matiereId);
        if (!matiereExists)
        {
            return "MatiereId invalide.";
        }

        var designationExists = await _context.Designations.AnyAsync(d => d.Id == designationId);
        if (!designationExists)
        {
            return "DesignationId invalide.";
        }

        return null;
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
        var uploadFolder = Path.Combine(webRoot, "uploads", "emplacements");

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

        return $"/uploads/emplacements/{fileName}";
    }

    private void DeleteImageFile(string imageUrl)
    {
        if (string.IsNullOrWhiteSpace(imageUrl))
        {
            return;
        }

        if (imageUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
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

    private byte[] BuildEmplacementPdf(Emplacement item, List<ArchiveLog> history)
    {
        var photoPath = GetPhysicalImagePath(item.ImageUrl);

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
                            header.Item().Text("FICHE D'IDENTITE - EMPLACEMENT")
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

                            info.Item().Text($"{item.Armoire}-{item.Numero}")
                                .FontSize(24)
                                .Bold()
                                .FontColor(Colors.Blue.Darken4);

                            info.Item().Text($"Désignation : {item.Designation?.Name ?? "Non renseignée"}")
                                .FontSize(13)
                                .SemiBold()
                                .FontColor(Colors.Red.Darken2);

                            info.Item().Text($"Matière : {item.Matiere?.NomMatiere ?? "Non renseignée"}")
                                .FontSize(11)
                                .FontColor(Colors.Grey.Darken2);

                            info.Item().Text($"Statut : {item.Status}")
                                .FontSize(11)
                                .FontColor(Colors.Grey.Darken2);
                        });

                        row.RelativeItem(1).Element(element =>
                        {
                            if (!string.IsNullOrWhiteSpace(photoPath) && System.IO.File.Exists(photoPath))
                            {
                                element
                                    .Height(135)
                                    .Border(1)
                                    .BorderColor(Colors.Grey.Lighten2)
                                    .Padding(5)
                                    .Image(photoPath)
                                    .FitArea();
                            }
                            else
                            {
                                element
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

                        AddInfoRow(table, "ID", item.Id.ToString());
                        AddInfoRow(table, "Matière", item.Matiere?.NomMatiere ?? "Non renseignée");
                        AddInfoRow(table, "Armoire", item.Armoire);
                        AddInfoRow(table, "Numéro", item.Numero);
                        AddInfoRow(table, "Désignation", item.Designation?.Name ?? "Non renseignée");
                        AddInfoRow(table, "Statut", item.Status);
                        AddInfoRow(table, "Photo", string.IsNullOrWhiteSpace(item.ImageUrl) ? "Non disponible" : item.ImageUrl);
                        AddInfoRow(table, "Date de creation", FormatDate(item.CreatedAt));
                        AddInfoRow(table, "Derniere modification", item.UpdatedAt.HasValue ? FormatDate(item.UpdatedAt.Value) : "Non modifie");
                    });

                    column.Item().PaddingTop(8).Text("Historique de creation et de modification")
                        .FontSize(15)
                        .Bold()
                        .FontColor(Colors.Red.Darken2);

                    if (history.Count == 0)
                    {
                        column.Item()
                            .Background(Colors.Grey.Lighten4)
                            .Border(1)
                            .BorderColor(Colors.Grey.Lighten2)
                            .Padding(14)
                            .Text("Aucun historique detaille disponible pour cet emplacement.")
                            .FontSize(10)
                            .FontColor(Colors.Grey.Darken2);
                    }
                    else
                    {
                        column.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(2);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Element(CellLabelStyle).Text("Date").SemiBold();
                                header.Cell().Element(CellLabelStyle).Text("Action").SemiBold();
                                header.Cell().Element(CellLabelStyle).Text("Description").SemiBold();
                            });

                            foreach (var log in history)
                            {
                                table.Cell().Element(CellValueStyle).Text(FormatDate(log.CreatedAt));
                                table.Cell().Element(CellValueStyle).Text(log.Action);
                                table.Cell().Element(CellValueStyle).Text(log.Description ?? "-");
                            }
                        });
                    }

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
                        text.Span("iTools - Fiche emplacement - Page ");
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
            return "emplacement";
        }

        return cleaned.Replace(' ', '_');
    }
}