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
public class LignesController : ControllerBase
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

    public LignesController(
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
    public async Task<ActionResult<IEnumerable<LigneDto>>> GetAll()
    {
        var items = await _context.Lignes
            .OrderBy(l => l.Id)
            .Select(l => new LigneDto
            {
                Id = l.Id,
                Nom = l.Nom,
                Nomenclature = l.Nomenclature,
                ImageUrl = l.ImageUrl,
                CreatedAt = l.CreatedAt,
                UpdatedAt = l.UpdatedAt
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<LigneDto>> GetById(int id)
    {
        var item = await _context.Lignes.FindAsync(id);

        if (item == null)
        {
            return NotFound("Ligne introuvable.");
        }

        return Ok(ToDto(item));
    }

    [HttpPost]
    [Consumes("multipart/form-data")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<ActionResult<LigneDto>> Create([FromForm] CreateLigneDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nom))
        {
            return BadRequest("Le nom de la ligne est obligatoire.");
        }

        var nom = dto.Nom.Trim();

        var exists = await _context.Lignes
            .AnyAsync(l => l.Nom == nom);

        if (exists)
        {
            return BadRequest("Cette ligne existe déjà.");
        }

        var imageUrl = await SaveImageAsync(dto.Image);

        var item = new Ligne
        {
            Nom = nom,
            Nomenclature = NormalizeNomenclature(dto.Nomenclature),
            ImageUrl = imageUrl,
            CreatedAt = dto.CreatedAt ?? DateTime.UtcNow,
            UpdatedAt = null
        };

        _context.Lignes.Add(item);
        await _context.SaveChangesAsync();

        var result = ToDto(item);

        await _archiveService.AddAsync(
            action: "CREATE",
            entityName: "Ligne",
            entityId: item.Id,
            description: $"Ajout de la ligne : {item.Nom}",
            oldValues: null,
            newValues: result
        );

        return CreatedAtAction(nameof(GetById), new { id = item.Id }, result);
    }

    [HttpPut("{id}")]
    [Consumes("multipart/form-data")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> Update(int id, [FromForm] UpdateLigneDto dto)
    {
        var item = await _context.Lignes.FindAsync(id);

        if (item == null)
        {
            return NotFound("Ligne introuvable.");
        }

        if (string.IsNullOrWhiteSpace(dto.Nom))
        {
            return BadRequest("Le nom de la ligne est obligatoire.");
        }

        var nom = dto.Nom.Trim();

        var exists = await _context.Lignes
            .AnyAsync(l => l.Nom == nom && l.Id != id);

        if (exists)
        {
            return BadRequest("Cette ligne existe déjà.");
        }

        var oldValues = new
        {
            item.Id,
            item.Nom,
            item.Nomenclature,
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

        item.Nom = nom;
        item.Nomenclature = NormalizeNomenclature(dto.Nomenclature);
        item.CreatedAt = dto.CreatedAt ?? item.CreatedAt;
        item.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var newValues = new
        {
            item.Id,
            item.Nom,
            item.Nomenclature,
            item.ImageUrl,
            item.CreatedAt,
            item.UpdatedAt
        };

        await _archiveService.AddAsync(
            action: "UPDATE",
            entityName: "Ligne",
            entityId: item.Id,
            description: $"Modification de la ligne : {item.Nom}",
            oldValues: oldValues,
            newValues: newValues
        );

        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _context.Lignes.FindAsync(id);

        if (item == null)
        {
            return NotFound("Ligne introuvable.");
        }

        var oldValues = new
        {
            item.Id,
            item.Nom,
            item.Nomenclature,
            item.ImageUrl,
            item.CreatedAt,
            item.UpdatedAt
        };

        if (!string.IsNullOrWhiteSpace(item.ImageUrl))
        {
            DeleteImageFile(item.ImageUrl);
        }

        _context.Lignes.Remove(item);
        await _context.SaveChangesAsync();

        await _archiveService.AddAsync(
            action: "DELETE",
            entityName: "Ligne",
            entityId: id,
            description: $"Suppression de la ligne : {oldValues.Nom}",
            oldValues: oldValues,
            newValues: null
        );

        return NoContent();
    }

    [HttpGet("{id}/identity-card")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> DownloadIdentityCard(int id)
    {
        var item = await _context.Lignes.FindAsync(id);

        if (item == null)
        {
            return NotFound("Ligne introuvable.");
        }

        QuestPDF.Settings.License = LicenseType.Community;

        var pdfBytes = BuildLignePdf(item);
        var fileName = $"fiche_ligne_{item.Id}_{SafeFileName(item.Nom)}.pdf";

        await _archiveService.AddAsync(
            action: "DOWNLOAD_PDF",
            entityName: "Ligne",
            entityId: item.Id,
            description: $"Téléchargement de la fiche PDF de la ligne : {item.Nom}",
            oldValues: null,
            newValues: new
            {
                item.Id,
                item.Nom,
                item.Nomenclature,
                item.ImageUrl,
                item.CreatedAt,
                item.UpdatedAt
            }
        );

        return File(pdfBytes, "application/pdf", fileName);
    }

    private LigneDto ToDto(Ligne item)
    {
        return new LigneDto
        {
            Id = item.Id,
            Nom = item.Nom,
            Nomenclature = item.Nomenclature,
            ImageUrl = item.ImageUrl,
            CreatedAt = item.CreatedAt,
            UpdatedAt = item.UpdatedAt
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
        var uploadFolder = Path.Combine(webRoot, "uploads", "lignes");

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

        return $"/uploads/lignes/{fileName}";
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

    private string NormalizeNomenclature(string? nomenclature)
    {
        if (string.IsNullOrWhiteSpace(nomenclature))
        {
            return "Générale";
        }

        return nomenclature.Trim();
    }

    private byte[] BuildLignePdf(Ligne item)
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
                            header.Item().Text("FICHE D'IDENTITE - LIGNE")
                                .FontSize(22)
                                .Bold()
                                .FontColor(Colors.White);

                            header.Item().PaddingTop(5).Text("iTools - Gestion des lignes")
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

                            info.Item().Text(item.Nom)
                                .FontSize(24)
                                .Bold()
                                .FontColor(Colors.Blue.Darken4);

                            info.Item().Text($"Nomenclature : {item.Nomenclature}")
                                .FontSize(13)
                                .SemiBold()
                                .FontColor(Colors.Red.Darken2);

                            info.Item().Text($"Identifiant : {item.Id}")
                                .FontSize(11)
                                .FontColor(Colors.Grey.Darken2);
                        });

                        row.RelativeItem(1).Element(photo =>
                        {
                            if (!string.IsNullOrWhiteSpace(photoPath) && System.IO.File.Exists(photoPath))
                            {
                                photo
                                    .Height(135)
                                    .Border(1)
                                    .BorderColor(Colors.Grey.Lighten2)
                                    .Padding(5)
                                    .Image(photoPath)
                                    .FitArea();
                            }
                            else
                            {
                                photo
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
                        AddInfoRow(table, "Nom ligne", item.Nom);
                        AddInfoRow(table, "Nomenclature", item.Nomenclature);
                        AddInfoRow(table, "Photo", string.IsNullOrWhiteSpace(item.ImageUrl) ? "Non disponible" : item.ImageUrl);
                        AddInfoRow(table, "Date de creation", FormatDate(item.CreatedAt));
                        AddInfoRow(table, "Derniere modification", item.UpdatedAt.HasValue ? FormatDate(item.UpdatedAt.Value) : "Non modifiee");
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

                            history.Item().Text($"Creation : {FormatDate(item.CreatedAt)}")
                                .FontSize(11)
                                .SemiBold();

                            history.Item().Text(item.UpdatedAt.HasValue
                                    ? $"Modification : {FormatDate(item.UpdatedAt.Value)}"
                                    : "Modification : aucune modification renseignee")
                                .FontSize(11)
                                .SemiBold();

                            history.Item().Text("Cette fiche resume les informations actuelles de la ligne ainsi que les dates principales de son cycle de vie.")
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
                        text.Span("iTools - Fiche ligne - Page ");
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
            return "ligne";
        }

        return cleaned.Replace(' ', '_');
    }
}