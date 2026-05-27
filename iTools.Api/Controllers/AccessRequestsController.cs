using System.Security.Claims;
using System.Security.Cryptography;
using iTools.Api.Data;
using iTools.Api.DTOs;
using iTools.Api.Models;
using iTools.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iTools.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AccessRequestsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly EmailService _emailService;
    private readonly ArchiveService _archiveService;

    public AccessRequestsController(
        ApplicationDbContext context,
        EmailService emailService,
        ArchiveService archiveService)
    {
        _context = context;
        _emailService = emailService;
        _archiveService = archiveService;
    }

    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> Create(CreateAccessRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.FullName))
        {
            return BadRequest("Le nom complet est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Matricule))
        {
            return BadRequest("Le matricule TIS est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Email))
        {
            return BadRequest("L’email est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.PhoneNumber))
        {
            return BadRequest("Le numéro de téléphone est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Department))
        {
            return BadRequest("Le service ou département est obligatoire.");
        }

        var email = dto.Email.Trim().ToLowerInvariant();
        var matricule = dto.Matricule.Trim();

        var existingUser = await _context.Users.AnyAsync(u => u.Email == email);
        if (existingUser)
        {
            return BadRequest("Un compte existe déjà avec cet email.");
        }

        var existingPendingRequest = await _context.AccessRequests.AnyAsync(r =>
            r.Email == email &&
            r.Status == "EN_ATTENTE");

        if (existingPendingRequest)
        {
            return BadRequest("Une demande d’accès est déjà en attente pour cet email.");
        }

        var request = new AccessRequest
        {
            FullName = dto.FullName.Trim(),
            Matricule = matricule,
            Email = email,
            PhoneNumber = dto.PhoneNumber.Trim(),
            Department = dto.Department.Trim(),
            Message = string.IsNullOrWhiteSpace(dto.Message) ? null : dto.Message.Trim(),
            Status = "EN_ATTENTE",
            CreatedAt = DateTime.UtcNow
        };

        _context.AccessRequests.Add(request);
        await _context.SaveChangesAsync();

        var admins = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.Role != null && u.Role.Name == "ADMIN")
            .ToListAsync();

        foreach (var admin in admins)
        {
            _context.UserNotifications.Add(new UserNotification
            {
                UserId = admin.Id,
                Title = "Nouvelle demande d’accès",
                Message = $"Une nouvelle demande d’accès a été envoyée par {request.FullName} ({request.Email}).",
                Type = "ACCESS_REQUEST",
                IsRead = false,
                CreatedAt = DateTime.Now
            });
        }

        await _context.SaveChangesAsync();

        await _archiveService.AddAsync(
            action: "CREATE",
            entityName: "AccessRequest",
            entityId: request.Id,
            description: $"Nouvelle demande d’accès : {request.FullName}",
            oldValues: null,
            newValues: new
            {
                request.Id,
                request.FullName,
                request.Matricule,
                request.Email,
                request.PhoneNumber,
                request.Department,
                request.Status,
                request.CreatedAt
            }
        );

        return Ok(new
        {
            message = "Votre demande d’accès a été envoyée avec succès. Un administrateur la traitera prochainement."
        });
    }

    [HttpGet]
    [Authorize(Roles = "ADMIN")]
    public async Task<ActionResult<IEnumerable<AccessRequestDto>>> GetAll()
    {
        var requests = await _context.AccessRequests
            .Include(r => r.TreatedByUser)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => ToDto(r))
            .ToListAsync();

        return Ok(requests);
    }

    [HttpGet("pending")]
    [Authorize(Roles = "ADMIN")]
    public async Task<ActionResult<IEnumerable<AccessRequestDto>>> GetPending()
    {
        var requests = await _context.AccessRequests
            .Include(r => r.TreatedByUser)
            .Where(r => r.Status == "EN_ATTENTE")
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => ToDto(r))
            .ToListAsync();

        return Ok(requests);
    }

    [HttpPut("{id}/approve")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Approve(int id, TreatAccessRequestDto dto)
    {
        var request = await _context.AccessRequests
            .Include(r => r.TreatedByUser)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request == null)
        {
            return NotFound("Demande d’accès introuvable.");
        }

        if (request.Status != "EN_ATTENTE")
        {
            return BadRequest("Cette demande a déjà été traitée.");
        }

        if (dto.RoleId <= 0)
        {
            return BadRequest("Le rôle est obligatoire pour créer le compte.");
        }

        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Id == dto.RoleId);

        if (role == null)
        {
            return BadRequest("Rôle invalide.");
        }

        var email = request.Email.Trim().ToLowerInvariant();

        var emailExists = await _context.Users.AnyAsync(u => u.Email == email);
        if (emailExists)
        {
            return BadRequest("Un utilisateur existe déjà avec cet email.");
        }

        var adminId = GetCurrentUserId();

        var temporaryPassword = GenerateTemporaryPassword();

        var user = new User
        {
            FullName = request.FullName,
            Email = email,
            PhoneNumber = request.PhoneNumber,
            Address = request.Department,
            RoleId = role.Id,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(temporaryPassword),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = null
        };

        _context.Users.Add(user);

        request.Status = "ACCEPTEE";
        request.DecisionComment = string.IsNullOrWhiteSpace(dto.DecisionComment)
            ? "Demande acceptée."
            : dto.DecisionComment.Trim();
        request.TreatedAt = DateTime.UtcNow;
        request.TreatedByUserId = adminId;

        await _context.SaveChangesAsync();

        await _emailService.SendAccessRequestAcceptedEmailAsync(
            request.Email,
            request.FullName,
            user.Email,
            temporaryPassword
        );

        await _archiveService.AddAsync(
            action: "APPROVE",
            entityName: "AccessRequest",
            entityId: request.Id,
            description: $"Demande d’accès acceptée : {request.FullName}",
            oldValues: null,
            newValues: new
            {
                request.Id,
                request.FullName,
                request.Email,
                request.Matricule,
                request.Status,
                CreatedUserId = user.Id,
                CreatedUserEmail = user.Email,
                Role = role.Name,
                request.TreatedAt,
                request.TreatedByUserId
            }
        );

        return Ok(new
        {
            message = "Demande acceptée. Le compte utilisateur a été créé et un email a été envoyé.",
            userId = user.Id
        });
    }

    [HttpPut("{id}/reject")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Reject(int id, TreatAccessRequestDto dto)
    {
        var request = await _context.AccessRequests
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request == null)
        {
            return NotFound("Demande d’accès introuvable.");
        }

        if (request.Status != "EN_ATTENTE")
        {
            return BadRequest("Cette demande a déjà été traitée.");
        }

        var adminId = GetCurrentUserId();

        request.Status = "REFUSEE";
        request.DecisionComment = string.IsNullOrWhiteSpace(dto.DecisionComment)
            ? "Demande refusée."
            : dto.DecisionComment.Trim();
        request.TreatedAt = DateTime.UtcNow;
        request.TreatedByUserId = adminId;

        await _context.SaveChangesAsync();

        await _emailService.SendAccessRequestRejectedEmailAsync(
            request.Email,
            request.FullName,
            request.DecisionComment
        );

        await _archiveService.AddAsync(
            action: "REJECT",
            entityName: "AccessRequest",
            entityId: request.Id,
            description: $"Demande d’accès refusée : {request.FullName}",
            oldValues: null,
            newValues: new
            {
                request.Id,
                request.FullName,
                request.Email,
                request.Matricule,
                request.Status,
                request.DecisionComment,
                request.TreatedAt,
                request.TreatedByUserId
            }
        );

        return Ok(new
        {
            message = "Demande refusée. Un email de réponse a été envoyé."
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

    private static AccessRequestDto ToDto(AccessRequest request)
    {
        return new AccessRequestDto
        {
            Id = request.Id,
            FullName = request.FullName,
            Matricule = request.Matricule,
            Email = request.Email,
            PhoneNumber = request.PhoneNumber,
            Department = request.Department,
            Message = request.Message,
            Status = request.Status,
            DecisionComment = request.DecisionComment,
            CreatedAt = request.CreatedAt,
            TreatedAt = request.TreatedAt,
            TreatedByUserId = request.TreatedByUserId,
            TreatedByUserName = request.TreatedByUser != null
                ? request.TreatedByUser.FullName
                : null
        };
    }

    private static string GenerateTemporaryPassword()
    {
        const string uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string lowercase = "abcdefghijkmnopqrstuvwxyz";
        const string digits = "23456789";
        const string symbols = "!@#$%";

        var allChars = uppercase + lowercase + digits + symbols;

        Span<char> password = stackalloc char[10];

        password[0] = uppercase[RandomNumberGenerator.GetInt32(uppercase.Length)];
        password[1] = lowercase[RandomNumberGenerator.GetInt32(lowercase.Length)];
        password[2] = digits[RandomNumberGenerator.GetInt32(digits.Length)];
        password[3] = symbols[RandomNumberGenerator.GetInt32(symbols.Length)];

        for (var i = 4; i < password.Length; i++)
        {
            password[i] = allChars[RandomNumberGenerator.GetInt32(allChars.Length)];
        }

        for (var i = 0; i < password.Length; i++)
        {
            var j = RandomNumberGenerator.GetInt32(password.Length);
            (password[i], password[j]) = (password[j], password[i]);
        }

        return new string(password);
    }
}