using System.Security.Claims;
using iTools.Api.Data;
using iTools.Api.DTOs;
using iTools.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iTools.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IWebHostEnvironment _environment;

    public ProfileController(
        ApplicationDbContext context,
        IWebHostEnvironment environment)
    {
        _context = context;
        _environment = environment;
    }

    [HttpGet("me")]
    public async Task<ActionResult<ProfileDto>> GetMyProfile()
    {
        var userId = GetCurrentUserId();

        if (userId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId.Value);

        if (user == null)
        {
            return NotFound("Utilisateur introuvable.");
        }

        return Ok(new ProfileDto
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email,
            Role = user.Role != null ? user.Role.Name : "",
            PhoneNumber = user.PhoneNumber,
            Address = user.Address,
            ProfilePhotoUrl = user.ProfilePhotoUrl
        });
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateMyProfile(UpdateProfileDto dto)
    {
        var userId = GetCurrentUserId();

        if (userId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        if (string.IsNullOrWhiteSpace(dto.FullName))
        {
            return BadRequest("Le nom complet est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Email))
        {
            return BadRequest("L’email est obligatoire.");
        }

        var fullName = dto.FullName.Trim();
        var email = dto.Email.Trim();
        var phoneNumber = dto.PhoneNumber?.Trim();
        var address = dto.Address?.Trim();

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId.Value);

        if (user == null)
        {
            return NotFound("Utilisateur introuvable.");
        }

        var emailUsedByAnother = await _context.Users
            .AnyAsync(u => u.Email == email && u.Id != user.Id);

        if (emailUsedByAnother)
        {
            return BadRequest("Cet email est déjà utilisé par un autre utilisateur.");
        }

        var oldValues = new
        {
            user.Id,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            user.Address,
            user.ProfilePhotoUrl
        };

        user.FullName = fullName;
        user.Email = email;
        user.PhoneNumber = phoneNumber;
        user.Address = address;

        await _context.SaveChangesAsync();

        var newValues = new
        {
            user.Id,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            user.Address,
            user.ProfilePhotoUrl
        };

        await AddArchiveAsync(
            user,
            action: "UPDATE_PROFILE",
            description: $"Modification du profil : {user.FullName}",
            oldValues: oldValues,
            newValues: newValues
        );

        await AddNotificationAsync(
            user.Id,
            "Profil modifié",
            "Vos informations personnelles ont été mises à jour.",
            "PROFILE"
        );

        return NoContent();
    }

    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordDto dto)
    {
        var userId = GetCurrentUserId();

        if (userId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        if (string.IsNullOrWhiteSpace(dto.CurrentPassword))
        {
            return BadRequest("Le mot de passe actuel est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.NewPassword))
        {
            return BadRequest("Le nouveau mot de passe est obligatoire.");
        }

        if (dto.NewPassword != dto.ConfirmPassword)
        {
            return BadRequest("La confirmation du mot de passe ne correspond pas.");
        }

        if (dto.NewPassword.Length < 6)
        {
            return BadRequest("Le nouveau mot de passe doit contenir au moins 6 caractères.");
        }

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId.Value);

        if (user == null)
        {
            return NotFound("Utilisateur introuvable.");
        }

        var isCurrentPasswordValid = BCrypt.Net.BCrypt.Verify(
            dto.CurrentPassword,
            user.PasswordHash
        );

        if (!isCurrentPasswordValid)
        {
            return BadRequest("Le mot de passe actuel est incorrect.");
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);

        await _context.SaveChangesAsync();

        await AddArchiveAsync(
            user,
            action: "CHANGE_PASSWORD",
            description: $"Changement du mot de passe : {user.FullName}",
            oldValues: null,
            newValues: new
            {
                user.Id,
                user.FullName,
                Date = DateTime.Now
            }
        );

        await AddNotificationAsync(
            user.Id,
            "Mot de passe modifié",
            "Votre mot de passe a été changé avec succès.",
            "SECURITY"
        );

        return Ok(new
        {
            message = "Mot de passe modifié avec succès."
        });
    }

    [HttpPost("photo")]
    public async Task<IActionResult> UploadProfilePhoto(IFormFile file)
    {
        var userId = GetCurrentUserId();

        if (userId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest("Aucun fichier reçu.");
        }

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();

        if (!allowedExtensions.Contains(extension))
        {
            return BadRequest("Format non autorisé. Formats acceptés : jpg, jpeg, png, webp.");
        }

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId.Value);

        if (user == null)
        {
            return NotFound("Utilisateur introuvable.");
        }

        var uploadsFolder = Path.Combine(
            _environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"),
            "profile-photos"
        );

        if (!Directory.Exists(uploadsFolder))
        {
            Directory.CreateDirectory(uploadsFolder);
        }

        var oldPhotoUrl = user.ProfilePhotoUrl;

        var fileName = $"user_{user.Id}_{Guid.NewGuid()}{extension}";
        var filePath = Path.Combine(uploadsFolder, fileName);

        await using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        user.ProfilePhotoUrl = $"/profile-photos/{fileName}";

        await _context.SaveChangesAsync();

        DeleteProfilePhotoFile(oldPhotoUrl);

        await AddArchiveAsync(
            user,
            action: "UPDATE_PROFILE_PHOTO",
            description: $"Modification de la photo de profil : {user.FullName}",
            oldValues: new
            {
                ProfilePhotoUrl = oldPhotoUrl
            },
            newValues: new
            {
                user.ProfilePhotoUrl
            }
        );

        await AddNotificationAsync(
            user.Id,
            "Photo de profil modifiée",
            "Votre photo de profil a été mise à jour.",
            "PROFILE"
        );

        return Ok(new
        {
            profilePhotoUrl = user.ProfilePhotoUrl
        });
    }

    [HttpDelete("photo")]
    public async Task<IActionResult> DeleteProfilePhoto()
    {
        var userId = GetCurrentUserId();

        if (userId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId.Value);

        if (user == null)
        {
            return NotFound("Utilisateur introuvable.");
        }

        if (string.IsNullOrWhiteSpace(user.ProfilePhotoUrl))
        {
            return BadRequest("Aucune photo de profil à supprimer.");
        }

        var oldPhotoUrl = user.ProfilePhotoUrl;

        user.ProfilePhotoUrl = null;

        await _context.SaveChangesAsync();

        DeleteProfilePhotoFile(oldPhotoUrl);

        await AddArchiveAsync(
            user,
            action: "DELETE_PROFILE_PHOTO",
            description: $"Suppression de la photo de profil : {user.FullName}",
            oldValues: new
            {
                ProfilePhotoUrl = oldPhotoUrl
            },
            newValues: new
            {
                ProfilePhotoUrl = user.ProfilePhotoUrl
            }
        );

        await AddNotificationAsync(
            user.Id,
            "Photo de profil supprimée",
            "Votre photo de profil a été supprimée.",
            "PROFILE"
        );

        return Ok(new
        {
            message = "Photo de profil supprimée avec succès."
        });
    }

    [HttpGet("notifications")]
    public async Task<ActionResult<IEnumerable<UserNotificationDto>>> GetMyNotifications()
    {
        var userId = GetCurrentUserId();

        if (userId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        var notifications = await _context.UserNotifications
            .Where(n => n.UserId == userId.Value)
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new UserNotificationDto
            {
                Id = n.Id,
                Title = n.Title,
                Message = n.Message,
                Type = n.Type,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync();

        return Ok(notifications);
    }

    [HttpPut("notifications/{id}/read")]
    public async Task<IActionResult> MarkNotificationAsRead(int id)
    {
        var userId = GetCurrentUserId();

        if (userId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        var notification = await _context.UserNotifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId.Value);

        if (notification == null)
        {
            return NotFound("Notification introuvable.");
        }

        notification.IsRead = true;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("notifications/{id}")]
    public async Task<IActionResult> DeleteNotification(int id)
    {
        var userId = GetCurrentUserId();

        if (userId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        var notification = await _context.UserNotifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId.Value);

        if (notification == null)
        {
            return NotFound("Notification introuvable.");
        }

        _context.UserNotifications.Remove(notification);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("notifications/delete-selected")]
    public async Task<IActionResult> DeleteSelectedNotifications(DeleteNotificationsDto dto)
    {
        var userId = GetCurrentUserId();

        if (userId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        if (dto.NotificationIds == null || dto.NotificationIds.Count == 0)
        {
            return BadRequest("Aucune notification sélectionnée.");
        }

        var notifications = await _context.UserNotifications
            .Where(n => n.UserId == userId.Value && dto.NotificationIds.Contains(n.Id))
            .ToListAsync();

        _context.UserNotifications.RemoveRange(notifications);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            deleted = notifications.Count
        });
    }

    [HttpDelete("notifications")]
    public async Task<IActionResult> DeleteAllNotifications()
    {
        var userId = GetCurrentUserId();

        if (userId == null)
        {
            return Unauthorized("Utilisateur non authentifié.");
        }

        var notifications = await _context.UserNotifications
            .Where(n => n.UserId == userId.Value)
            .ToListAsync();

        _context.UserNotifications.RemoveRange(notifications);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            deleted = notifications.Count
        });
    }

    private int? GetCurrentUserId()
    {
        var userIdValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (int.TryParse(userIdValue, out var userId))
        {
            return userId;
        }

        return null;
    }

    private void DeleteProfilePhotoFile(string? profilePhotoUrl)
    {
        if (string.IsNullOrWhiteSpace(profilePhotoUrl))
        {
            return;
        }

        if (!profilePhotoUrl.StartsWith("/profile-photos/", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var fileName = Path.GetFileName(profilePhotoUrl);

        if (string.IsNullOrWhiteSpace(fileName))
        {
            return;
        }

        var uploadsFolder = Path.Combine(
            _environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"),
            "profile-photos"
        );

        var filePath = Path.Combine(uploadsFolder, fileName);

        if (System.IO.File.Exists(filePath))
        {
            System.IO.File.Delete(filePath);
        }
    }

    private async Task AddArchiveAsync(
        User user,
        string action,
        string description,
        object? oldValues,
        object? newValues)
    {
        var archive = new ArchiveLog
        {
            UserId = user.Id,
            UserName = user.FullName,
            Role = user.Role != null ? user.Role.Name : "",
            Action = action,
            EntityName = "Profile",
            EntityId = user.Id,
            Description = description,
            OldValues = oldValues == null ? null : System.Text.Json.JsonSerializer.Serialize(oldValues),
            NewValues = newValues == null ? null : System.Text.Json.JsonSerializer.Serialize(newValues),
            CreatedAt = DateTime.Now
        };

        _context.ArchiveLogs.Add(archive);
        await _context.SaveChangesAsync();
    }

    private async Task AddNotificationAsync(
        int userId,
        string title,
        string message,
        string type)
    {
        var notification = new UserNotification
        {
            UserId = userId,
            Title = title,
            Message = message,
            Type = type,
            IsRead = false,
            CreatedAt = DateTime.Now
        };

        _context.UserNotifications.Add(notification);
        await _context.SaveChangesAsync();
    }
}