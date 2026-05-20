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
[Authorize(Roles = "ADMIN,RESPONSABLE")]
public class UsersController : ControllerBase
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

    public UsersController(
        ApplicationDbContext context,
        ArchiveService archiveService,
        IWebHostEnvironment environment)
    {
        _context = context;
        _archiveService = archiveService;
        _environment = environment;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserListItemDto>>> GetAll()
    {
        var users = await _context.Users
            .Include(u => u.Role)
            .OrderBy(u => u.Id)
            .Select(u => new UserListItemDto
            {
                Id = u.Id,
                FullName = u.FullName,
                Email = u.Email,
                RoleId = u.RoleId,
                RoleName = u.Role != null ? u.Role.Name : "",
                ProfilePhotoUrl = u.ProfilePhotoUrl,
                CreatedAt = u.CreatedAt,
                UpdatedAt = u.UpdatedAt
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<UserListItemDto>> GetById(int id)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.Id == id)
            .Select(u => new UserListItemDto
            {
                Id = u.Id,
                FullName = u.FullName,
                Email = u.Email,
                RoleId = u.RoleId,
                RoleName = u.Role != null ? u.Role.Name : "",
                ProfilePhotoUrl = u.ProfilePhotoUrl,
                CreatedAt = u.CreatedAt,
                UpdatedAt = u.UpdatedAt
            })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return NotFound("Utilisateur introuvable.");
        }

        return Ok(user);
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<UserListItemDto>> Create([FromForm] CreateUserDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.FullName))
        {
            return BadRequest("Le nom complet est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Email))
        {
            return BadRequest("L’email est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Password))
        {
            return BadRequest("Le mot de passe est obligatoire.");
        }

        if (dto.RoleId <= 0)
        {
            return BadRequest("Le rôle est obligatoire.");
        }

        var fullName = dto.FullName.Trim();
        var email = dto.Email.Trim();

        var roleExists = await _context.Roles.AnyAsync(r => r.Id == dto.RoleId);
        if (!roleExists)
        {
            return BadRequest("RoleId invalide.");
        }

        var emailExists = await _context.Users.AnyAsync(u => u.Email == email);
        if (emailExists)
        {
            return BadRequest("Cet email existe déjà.");
        }

        var photoUrl = await SaveImageAsync(dto.Image);

        var user = new User
        {
            FullName = fullName,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            RoleId = dto.RoleId,
            ProfilePhotoUrl = photoUrl,
            CreatedAt = dto.CreatedAt ?? DateTime.UtcNow,
            UpdatedAt = null
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var createdUser = await ToDtoQuery(user.Id).FirstAsync();

        await _archiveService.AddAsync(
            action: "CREATE",
            entityName: "User",
            entityId: user.Id,
            description: $"Ajout de l’utilisateur : {createdUser.FullName}",
            oldValues: null,
            newValues: createdUser
        );

        return CreatedAtAction(nameof(GetById), new { id = user.Id }, createdUser);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "ADMIN")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Update(int id, [FromForm] UpdateUserDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null)
        {
            return NotFound("Utilisateur introuvable.");
        }

        if (string.IsNullOrWhiteSpace(dto.FullName))
        {
            return BadRequest("Le nom complet est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Email))
        {
            return BadRequest("L’email est obligatoire.");
        }

        if (dto.RoleId <= 0)
        {
            return BadRequest("Le rôle est obligatoire.");
        }

        var fullName = dto.FullName.Trim();
        var email = dto.Email.Trim();

        var roleExists = await _context.Roles.AnyAsync(r => r.Id == dto.RoleId);
        if (!roleExists)
        {
            return BadRequest("RoleId invalide.");
        }

        var emailUsedByAnother = await _context.Users
            .AnyAsync(u => u.Email == email && u.Id != id);

        if (emailUsedByAnother)
        {
            return BadRequest("Cet email est déjà utilisé par un autre utilisateur.");
        }

        var oldValues = new
        {
            user.Id,
            user.FullName,
            user.Email,
            user.RoleId,
            RoleName = user.Role != null ? user.Role.Name : "",
            user.ProfilePhotoUrl,
            user.CreatedAt,
            user.UpdatedAt
        };

        if (dto.RemoveImage && !string.IsNullOrWhiteSpace(user.ProfilePhotoUrl))
        {
            DeleteImageFile(user.ProfilePhotoUrl);
            user.ProfilePhotoUrl = null;
        }

        if (dto.Image != null)
        {
            if (!string.IsNullOrWhiteSpace(user.ProfilePhotoUrl))
            {
                DeleteImageFile(user.ProfilePhotoUrl);
            }

            user.ProfilePhotoUrl = await SaveImageAsync(dto.Image);
        }

        user.FullName = fullName;
        user.Email = email;
        user.RoleId = dto.RoleId;
        user.CreatedAt = dto.CreatedAt ?? user.CreatedAt;
        user.UpdatedAt = DateTime.UtcNow;

        if (!string.IsNullOrWhiteSpace(dto.Password))
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
        }

        await _context.SaveChangesAsync();

        var updatedUser = await _context.Users
            .Include(u => u.Role)
            .FirstAsync(u => u.Id == id);

        var newValues = new
        {
            updatedUser.Id,
            updatedUser.FullName,
            updatedUser.Email,
            updatedUser.RoleId,
            RoleName = updatedUser.Role != null ? updatedUser.Role.Name : "",
            updatedUser.ProfilePhotoUrl,
            updatedUser.CreatedAt,
            updatedUser.UpdatedAt
        };

        await _archiveService.AddAsync(
            action: "UPDATE",
            entityName: "User",
            entityId: user.Id,
            description: $"Modification de l’utilisateur : {user.FullName}",
            oldValues: oldValues,
            newValues: newValues
        );

        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Delete(int id)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null)
        {
            return NotFound("Utilisateur introuvable.");
        }

        var oldValues = new
        {
            user.Id,
            user.FullName,
            user.Email,
            user.RoleId,
            RoleName = user.Role != null ? user.Role.Name : "",
            user.ProfilePhotoUrl,
            user.CreatedAt,
            user.UpdatedAt
        };

        if (!string.IsNullOrWhiteSpace(user.ProfilePhotoUrl))
        {
            DeleteImageFile(user.ProfilePhotoUrl);
        }

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        await _archiveService.AddAsync(
            action: "DELETE",
            entityName: "User",
            entityId: id,
            description: $"Suppression de l’utilisateur : {oldValues.FullName}",
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

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null)
        {
            return NotFound("Utilisateur introuvable.");
        }

        var history = await _context.ArchiveLogs
            .Where(a => a.EntityName == "User" && a.EntityId == user.Id)
            .OrderByDescending(a => a.CreatedAt)
            .Take(10)
            .ToListAsync();

        QuestPDF.Settings.License = LicenseType.Community;

        var pdfBytes = BuildUserPdf(user, history);
        var fileName = $"fiche_utilisateur_{user.Id}_{SafeFileName(user.FullName)}.pdf";

        await _archiveService.AddAsync(
            action: "DOWNLOAD_PDF",
            entityName: "User",
            entityId: user.Id,
            description: $"Téléchargement de la fiche PDF de l’utilisateur : {user.FullName}",
            oldValues: null,
            newValues: new
            {
                user.Id,
                user.FullName,
                user.Email,
                user.RoleId,
                RoleName = user.Role != null ? user.Role.Name : "",
                user.ProfilePhotoUrl,
                user.CreatedAt,
                user.UpdatedAt
            }
        );

        return File(pdfBytes, "application/pdf", fileName);
    }

    private IQueryable<UserListItemDto> ToDtoQuery(int userId)
    {
        return _context.Users
            .Include(u => u.Role)
            .Where(u => u.Id == userId)
            .Select(u => new UserListItemDto
            {
                Id = u.Id,
                FullName = u.FullName,
                Email = u.Email,
                RoleId = u.RoleId,
                RoleName = u.Role != null ? u.Role.Name : "",
                ProfilePhotoUrl = u.ProfilePhotoUrl,
                CreatedAt = u.CreatedAt,
                UpdatedAt = u.UpdatedAt
            });
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
        var uploadFolder = Path.Combine(webRoot, "uploads", "users");

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

        return $"/uploads/users/{fileName}";
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

        return role == "ADMIN" || role == "RESPONSABLE";
    }

    private byte[] BuildUserPdf(User user, List<ArchiveLog> history)
    {
        var photoPath = GetPhysicalImagePath(user.ProfilePhotoUrl);

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
                            header.Item().Text("FICHE D'IDENTITE - UTILISATEUR")
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

                            info.Item().Text(user.FullName)
                                .FontSize(24)
                                .Bold()
                                .FontColor(Colors.Blue.Darken4);

                            info.Item().Text($"Email : {user.Email}")
                                .FontSize(13)
                                .SemiBold()
                                .FontColor(Colors.Red.Darken2);

                            info.Item().Text($"Role : {user.Role?.Name ?? "Non renseigné"}")
                                .FontSize(11)
                                .FontColor(Colors.Grey.Darken2);

                            info.Item().Text($"Identifiant : {user.Id}")
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

                        AddInfoRow(table, "ID", user.Id.ToString());
                        AddInfoRow(table, "Nom complet", user.FullName);
                        AddInfoRow(table, "Email", user.Email);
                        AddInfoRow(table, "Role", user.Role?.Name ?? "Non renseigné");
                        AddInfoRow(table, "Photo", string.IsNullOrWhiteSpace(user.ProfilePhotoUrl) ? "Non disponible" : user.ProfilePhotoUrl);
                        AddInfoRow(table, "Date de creation", FormatDate(user.CreatedAt));
                        AddInfoRow(table, "Derniere modification", user.UpdatedAt.HasValue ? FormatDate(user.UpdatedAt.Value) : "Non modifie");
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
                            .Text("Aucun historique detaille disponible pour cet utilisateur.")
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
                        text.Span("iTools - Fiche utilisateur - Page ");
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
            return "utilisateur";
        }

        return cleaned.Replace(' ', '_');
    }
}