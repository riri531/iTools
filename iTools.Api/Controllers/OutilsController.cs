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
public class OutilsController : ControllerBase
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

    public OutilsController(
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
    public async Task<ActionResult<IEnumerable<OutilDto>>> GetAll()
    {
        var items = await _context.Outils
            .Include(o => o.Ligne)
            .Include(o => o.Client)
            .Include(o => o.Fournisseur)
            .Include(o => o.Emplacement)
            .OrderBy(o => o.Id)
            .Select(o => new OutilDto
            {
                Id = o.Id,
                LigneId = o.LigneId,
                LigneName = o.Ligne != null ? o.Ligne.Nom : "",
                ClientId = o.ClientId,
                ClientName = o.Client != null ? o.Client.NomClient : "",
                FournisseurId = o.FournisseurId,
                FournisseurName = o.Fournisseur != null ? o.Fournisseur.NomFournisseur : "",
                EmplacementId = o.EmplacementId,
                EmplacementLabel = o.Emplacement != null ? (o.Emplacement.Armoire + " - " + o.Emplacement.Numero) : "",
                OTT = o.OTT,
                CodeOutillage = o.CodeOutillage,
                Status = o.Status,
                Valeur = o.Valeur,
                JustificationHS = o.JustificationHS,
                DateAffectation = o.DateAffectation,
                ImageUrl = o.ImageUrl,
                CreatedAt = o.CreatedAt,
                UpdatedAt = o.UpdatedAt
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<OutilDto>> GetById(int id)
    {
        var item = await ToDtoQuery(id).FirstOrDefaultAsync();

        if (item == null)
        {
            return NotFound("Outil introuvable.");
        }

        return Ok(item);
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<OutilDto>> Create([FromForm] CreateOutilDto dto)
    {
        var validationError = await ValidateDtoAsync(
            dto.LigneId,
            dto.ClientId,
            dto.FournisseurId,
            dto.EmplacementId,
            dto.OTT,
            dto.CodeOutillage,
            dto.Status,
            dto.JustificationHS,
            null);

        if (validationError != null)
        {
            return BadRequest(validationError);
        }

        var ott = dto.OTT.Trim();
        var codeOutillage = dto.CodeOutillage.Trim();
        var status = dto.Status.Trim();
        var justificationHS = status == "HS" ? dto.JustificationHS?.Trim() : "";

        var imageUrl = await SaveImageAsync(dto.Image);

        var item = new Outil
        {
            LigneId = dto.LigneId,
            ClientId = dto.ClientId,
            FournisseurId = dto.FournisseurId,
            EmplacementId = dto.EmplacementId,
            OTT = ott,
            CodeOutillage = codeOutillage,
            Status = status,
            Valeur = dto.Valeur,
            JustificationHS = justificationHS,
            DateAffectation = dto.DateAffectation,
            ImageUrl = imageUrl,
            CreatedAt = dto.CreatedAt ?? DateTime.UtcNow,
            UpdatedAt = null
        };

        _context.Outils.Add(item);
        await _context.SaveChangesAsync();

        var result = await ToDtoQuery(item.Id).FirstAsync();

        await _archiveService.AddAsync(
            action: "CREATE",
            entityName: "Outil",
            entityId: item.Id,
            description: $"Ajout de l’outil : {item.CodeOutillage}",
            oldValues: null,
            newValues: result
        );

        return CreatedAtAction(nameof(GetById), new { id = item.Id }, result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Update(int id, [FromForm] UpdateOutilDto dto)
    {
        var item = await _context.Outils
            .Include(o => o.Ligne)
            .Include(o => o.Client)
            .Include(o => o.Fournisseur)
            .Include(o => o.Emplacement)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (item == null)
        {
            return NotFound("Outil introuvable.");
        }

        var validationError = await ValidateDtoAsync(
            dto.LigneId,
            dto.ClientId,
            dto.FournisseurId,
            dto.EmplacementId,
            dto.OTT,
            dto.CodeOutillage,
            dto.Status,
            dto.JustificationHS,
            id);

        if (validationError != null)
        {
            return BadRequest(validationError);
        }

        var oldValues = new
        {
            item.Id,
            item.LigneId,
            LigneName = item.Ligne != null ? item.Ligne.Nom : "",
            item.ClientId,
            ClientName = item.Client != null ? item.Client.NomClient : "",
            item.FournisseurId,
            FournisseurName = item.Fournisseur != null ? item.Fournisseur.NomFournisseur : "",
            item.EmplacementId,
            EmplacementLabel = item.Emplacement != null ? (item.Emplacement.Armoire + " - " + item.Emplacement.Numero) : "",
            item.OTT,
            item.CodeOutillage,
            item.Status,
            item.Valeur,
            item.JustificationHS,
            item.DateAffectation,
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

        var status = dto.Status.Trim();

        item.LigneId = dto.LigneId;
        item.ClientId = dto.ClientId;
        item.FournisseurId = dto.FournisseurId;
        item.EmplacementId = dto.EmplacementId;
        item.OTT = dto.OTT.Trim();
        item.CodeOutillage = dto.CodeOutillage.Trim();
        item.Status = status;
        item.Valeur = dto.Valeur;
        item.JustificationHS = status == "HS" ? dto.JustificationHS?.Trim() : "";
        item.DateAffectation = dto.DateAffectation;
        item.CreatedAt = dto.CreatedAt ?? item.CreatedAt;
        item.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var updatedItem = await _context.Outils
            .Include(o => o.Ligne)
            .Include(o => o.Client)
            .Include(o => o.Fournisseur)
            .Include(o => o.Emplacement)
            .FirstAsync(o => o.Id == id);

        var newValues = new
        {
            updatedItem.Id,
            updatedItem.LigneId,
            LigneName = updatedItem.Ligne != null ? updatedItem.Ligne.Nom : "",
            updatedItem.ClientId,
            ClientName = updatedItem.Client != null ? updatedItem.Client.NomClient : "",
            updatedItem.FournisseurId,
            FournisseurName = updatedItem.Fournisseur != null ? updatedItem.Fournisseur.NomFournisseur : "",
            updatedItem.EmplacementId,
            EmplacementLabel = updatedItem.Emplacement != null ? (updatedItem.Emplacement.Armoire + " - " + updatedItem.Emplacement.Numero) : "",
            updatedItem.OTT,
            updatedItem.CodeOutillage,
            updatedItem.Status,
            updatedItem.Valeur,
            updatedItem.JustificationHS,
            updatedItem.DateAffectation,
            updatedItem.ImageUrl,
            updatedItem.CreatedAt,
            updatedItem.UpdatedAt
        };

        await _archiveService.AddAsync(
            action: "UPDATE",
            entityName: "Outil",
            entityId: item.Id,
            description: $"Modification de l’outil : {item.CodeOutillage}",
            oldValues: oldValues,
            newValues: newValues
        );

        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _context.Outils
            .Include(o => o.Ligne)
            .Include(o => o.Client)
            .Include(o => o.Fournisseur)
            .Include(o => o.Emplacement)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (item == null)
        {
            return NotFound("Outil introuvable.");
        }

        var oldValues = new
        {
            item.Id,
            item.LigneId,
            LigneName = item.Ligne != null ? item.Ligne.Nom : "",
            item.ClientId,
            ClientName = item.Client != null ? item.Client.NomClient : "",
            item.FournisseurId,
            FournisseurName = item.Fournisseur != null ? item.Fournisseur.NomFournisseur : "",
            item.EmplacementId,
            EmplacementLabel = item.Emplacement != null ? (item.Emplacement.Armoire + " - " + item.Emplacement.Numero) : "",
            item.OTT,
            item.CodeOutillage,
            item.Status,
            item.Valeur,
            item.JustificationHS,
            item.DateAffectation,
            item.ImageUrl,
            item.CreatedAt,
            item.UpdatedAt
        };

        if (!string.IsNullOrWhiteSpace(item.ImageUrl))
        {
            DeleteImageFile(item.ImageUrl);
        }

        _context.Outils.Remove(item);
        await _context.SaveChangesAsync();

        await _archiveService.AddAsync(
            action: "DELETE",
            entityName: "Outil",
            entityId: id,
            description: $"Suppression de l’outil : {oldValues.CodeOutillage}",
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

        var item = await _context.Outils
            .Include(o => o.Ligne)
            .Include(o => o.Client)
            .Include(o => o.Fournisseur)
            .Include(o => o.Emplacement)
                .ThenInclude(e => e!.Matiere)
            .Include(o => o.Emplacement)
                .ThenInclude(e => e!.Designation)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (item == null)
        {
            return NotFound("Outil introuvable.");
        }

        var history = await _context.ArchiveLogs
            .Where(a => a.EntityName == "Outil" && a.EntityId == item.Id)
            .OrderByDescending(a => a.CreatedAt)
            .Take(10)
            .ToListAsync();

        QuestPDF.Settings.License = LicenseType.Community;

        var pdfBytes = BuildOutilPdf(item, history);
        var fileName = $"fiche_outil_{item.Id}_{SafeFileName(item.CodeOutillage)}.pdf";

        await _archiveService.AddAsync(
            action: "DOWNLOAD_PDF",
            entityName: "Outil",
            entityId: item.Id,
            description: $"Téléchargement de la fiche PDF de l’outil : {item.CodeOutillage}",
            oldValues: null,
            newValues: new
            {
                item.Id,
                item.LigneId,
                LigneName = item.Ligne != null ? item.Ligne.Nom : "",
                item.ClientId,
                ClientName = item.Client != null ? item.Client.NomClient : "",
                item.FournisseurId,
                FournisseurName = item.Fournisseur != null ? item.Fournisseur.NomFournisseur : "",
                item.EmplacementId,
                EmplacementLabel = item.Emplacement != null ? (item.Emplacement.Armoire + " - " + item.Emplacement.Numero) : "",
                item.OTT,
                item.CodeOutillage,
                item.Status,
                item.Valeur,
                item.JustificationHS,
                item.DateAffectation,
                item.ImageUrl,
                item.CreatedAt,
                item.UpdatedAt
            }
        );

        return File(pdfBytes, "application/pdf", fileName);
    }

    private IQueryable<OutilDto> ToDtoQuery(int id)
    {
        return _context.Outils
            .Include(o => o.Ligne)
            .Include(o => o.Client)
            .Include(o => o.Fournisseur)
            .Include(o => o.Emplacement)
            .Where(o => o.Id == id)
            .Select(o => new OutilDto
            {
                Id = o.Id,
                LigneId = o.LigneId,
                LigneName = o.Ligne != null ? o.Ligne.Nom : "",
                ClientId = o.ClientId,
                ClientName = o.Client != null ? o.Client.NomClient : "",
                FournisseurId = o.FournisseurId,
                FournisseurName = o.Fournisseur != null ? o.Fournisseur.NomFournisseur : "",
                EmplacementId = o.EmplacementId,
                EmplacementLabel = o.Emplacement != null ? (o.Emplacement.Armoire + " - " + o.Emplacement.Numero) : "",
                OTT = o.OTT,
                CodeOutillage = o.CodeOutillage,
                Status = o.Status,
                Valeur = o.Valeur,
                JustificationHS = o.JustificationHS,
                DateAffectation = o.DateAffectation,
                ImageUrl = o.ImageUrl,
                CreatedAt = o.CreatedAt,
                UpdatedAt = o.UpdatedAt
            });
    }

    private async Task<string?> ValidateDtoAsync(
        int ligneId,
        int clientId,
        int fournisseurId,
        int emplacementId,
        string ott,
        string codeOutillage,
        string status,
        string? justificationHS,
        int? currentId)
    {
        if (ligneId <= 0)
        {
            return "La ligne est obligatoire.";
        }

        if (clientId <= 0)
        {
            return "Le client est obligatoire.";
        }

        if (fournisseurId <= 0)
        {
            return "Le fournisseur est obligatoire.";
        }

        if (emplacementId <= 0)
        {
            return "L’emplacement est obligatoire.";
        }

        if (string.IsNullOrWhiteSpace(ott))
        {
            return "L’OTT est obligatoire.";
        }

        if (string.IsNullOrWhiteSpace(codeOutillage))
        {
            return "Le code outillage est obligatoire.";
        }

        if (string.IsNullOrWhiteSpace(status))
        {
            return "Le statut est obligatoire.";
        }

        var cleanStatus = status.Trim();

        if (cleanStatus == "HS" && string.IsNullOrWhiteSpace(justificationHS))
        {
            return "La justification HS est obligatoire lorsque le statut est HS.";
        }

        var ligneExists = await _context.Lignes.AnyAsync(x => x.Id == ligneId);
        if (!ligneExists)
        {
            return "LigneId invalide.";
        }

        var clientExists = await _context.Clients.AnyAsync(x => x.Id == clientId);
        if (!clientExists)
        {
            return "ClientId invalide.";
        }

        var fournisseurExists = await _context.Fournisseurs.AnyAsync(x => x.Id == fournisseurId);
        if (!fournisseurExists)
        {
            return "FournisseurId invalide.";
        }

        var emplacementExists = await _context.Emplacements.AnyAsync(x => x.Id == emplacementId);
        if (!emplacementExists)
        {
            return "EmplacementId invalide.";
        }

        var cleanOtt = ott.Trim();
        var cleanCode = codeOutillage.Trim();

        var exists = await _context.Outils.AnyAsync(o =>
            (o.CodeOutillage == cleanCode || o.OTT == cleanOtt) &&
            (!currentId.HasValue || o.Id != currentId.Value));

        if (exists)
        {
            return currentId.HasValue
                ? "Un autre outil avec ce code outillage ou cet OTT existe déjà."
                : "Un outil avec ce code outillage ou cet OTT existe déjà.";
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
        var uploadFolder = Path.Combine(webRoot, "uploads", "outils");

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

        return $"/uploads/outils/{fileName}";
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

    private byte[] BuildOutilPdf(Outil item, List<ArchiveLog> history)
    {
        var photoPath = GetPhysicalImagePath(item.ImageUrl);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(36);
                page.DefaultTextStyle(text => text.FontSize(11));

                page.Header().Column(column =>
                {
                    column.Item()
                        .Background(Colors.Red.Darken3)
                        .Padding(18)
                        .Column(header =>
                        {
                            header.Item().Text("FICHE D'IDENTITE - OUTIL")
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

                            info.Item().Text(item.CodeOutillage)
                                .FontSize(24)
                                .Bold()
                                .FontColor(Colors.Blue.Darken4);

                            info.Item().Text($"OTT : {item.OTT}")
                                .FontSize(13)
                                .SemiBold()
                                .FontColor(Colors.Red.Darken2);

                            info.Item().Text($"Statut : {item.Status}")
                                .FontSize(11)
                                .FontColor(Colors.Grey.Darken2);

                            info.Item().Text($"Valeur : {item.Valeur}")
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
                        AddInfoRow(table, "Ligne", item.Ligne?.Nom ?? "Non renseignée");
                        AddInfoRow(table, "Client", item.Client?.NomClient ?? "Non renseigné");
                        AddInfoRow(table, "Fournisseur", item.Fournisseur?.NomFournisseur ?? "Non renseigné");
                        AddInfoRow(table, "Emplacement", item.Emplacement != null ? $"{item.Emplacement.Armoire}-{item.Emplacement.Numero}" : "Non renseigné");
                        AddInfoRow(table, "Matière", item.Emplacement?.Matiere?.NomMatiere ?? "Non renseignée");
                        AddInfoRow(table, "Désignation", item.Emplacement?.Designation?.Name ?? "Non renseignée");
                        AddInfoRow(table, "OTT", item.OTT);
                        AddInfoRow(table, "Code outillage", item.CodeOutillage);
                        AddInfoRow(table, "Statut", item.Status);
                        AddInfoRow(table, "Valeur", item.Valeur.ToString("0.##"));
                        AddInfoRow(table, "Justification HS", string.IsNullOrWhiteSpace(item.JustificationHS) ? "Non renseignée" : item.JustificationHS);
                        AddInfoRow(table, "Date affectation", item.DateAffectation.HasValue ? FormatDate(item.DateAffectation.Value) : "Non renseignée");
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
                            .Text("Aucun historique detaille disponible pour cet outil.")
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
                        text.Span("iTools - Fiche outil - Page ");
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
            return "outil";
        }

        return cleaned.Replace(' ', '_');
    }
}